import NDK, { Nip46PermitCallback } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { Backend } from './backend/index.js';
import readline from 'readline';
import prisma from '../db.js';

export interface IOpts {
    keys: Record<string, string>;
    nostr: {
        relays: string[],
    }
    verbose: boolean;
}


export default async function run(opts: IOpts) {
    console.log(`nsecBunker daemon starting with PID ${process.pid}...`);
    console.log(`Connecting to ${opts.nostr.relays.length} relays...`);

    const ndk = new NDK({
        explicitRelayUrls: opts.nostr.relays,
    });
    await ndk.pool.on('connect', (r) => { console.log(`✅ Connected to ${r.url}`); });
    await ndk.pool.on('notice', (n, r) => { console.log(`👀 Notice from ${r.url}`, n); });
    await ndk.connect(5000);

    setTimeout(async () => {
        const promise = [];

        for (const [name, nsec] of Object.entries(opts.keys)) {
            const cb = callbackForKey(name);
            const hexpk = nip19.decode(nsec).data as string;
            const backend = new Backend(ndk, hexpk, cb);
            promise.push(backend.start());
        }

        await Promise.all(promise);

        console.log('✅ nsecBunker ready to serve requests.');
    }, 1000);
}

async function checkIfPubkeyAllowed(keyName: string, remotePubkey: string, method: string, param?: any): Promise<boolean | undefined> {
    // find KeyUser
    const keyUser = await prisma.keyUser.findUnique({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
    });

    if (!keyUser) {
        return undefined;
    }

    // find SigningCondition
    const signingConditionQuery = requestToSigningConditionQuery(method, param);

    const explicitReject = await prisma.signingCondition.findFirst({
        where: {
            keyUserId: keyUser.id,
            method: '*',
            allowed: false,
        }
    });

    if (explicitReject) {
        console.log(`explicit reject`, explicitReject);
        return false;
    }

    const signingCondition = await prisma.signingCondition.findFirst({
        where: {
            keyUserId: keyUser.id,
            ...signingConditionQuery,
        }
    });

    // if no SigningCondition found, return undefined
    if (!signingCondition) {
        return undefined;
    }

    const allowed = signingCondition.allowed;

    if (allowed === true || allowed === false) {
        console.log(`found signing condition`, signingCondition);
        return allowed;
    }

    return undefined;
}

function requestToSigningConditionQuery(method: string, param?: any) {
    const signingConditionQuery: any = { method };

    switch (method) {
        case 'sign_event':
            signingConditionQuery.kind = param.kind;
            break;
    }

    return signingConditionQuery;
}

async function allowAllRequestsFromKey(remotePubkey: string, keyName: string, method: string, param?: any): Promise<void> {
    try {

        // Upsert the KeyUser with the given remotePubkey
        const upsertedUser = await prisma.keyUser.upsert({
            where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
            update: { },
            create: { keyName, userPubkey: remotePubkey },
        });

        console.log({ upsertedUser });

        // Create a new SigningCondition for the given KeyUser and set allowed to true
        const signingConditionQuery = requestToSigningConditionQuery(method, param);
        await prisma.signingCondition.create({
            data: {
                allowed: true,
                keyUserId: upsertedUser.id,
                ...signingConditionQuery
            },
        });
    } catch (e) {
        console.log('allowAllRequestsFromKey', e);
    }
}

async function rejectAllRequestsFromKey(remotePubkey: string, keyName: string): Promise<void> {
        // Upsert the KeyUser with the given remotePubkey
    const upsertedUser = await prisma.keyUser.upsert({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
        update: { },
        create: { keyName, userPubkey: remotePubkey },
    });

    console.log({ upsertedUser });

    // Create a new SigningCondition for the given KeyUser and set allowed to false
    await prisma.signingCondition.create({
        data: {
            allowed: false,
            keyUserId: upsertedUser.id,
        },
    });
}


interface IAskYNquestionOpts {
    timeoutLength?: number;
    yes: any;
    no: any;
    always?: any;
    never?: any;
    response?: any;
    timeout?: any;
}

async function askYNquestion(
    question: string,
    opts: IAskYNquestionOpts
) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let timeout: NodeJS.Timeout | undefined;

    if (opts.timeoutLength) {
        timeout = setTimeout(() => {
            rl.close();
            opts.timeout && opts.timeout();
        }, opts.timeoutLength);
    }

    const prompts = ['y', 'n'];

    if (opts.always) prompts.push('always');
    if (opts.never) prompts.push('never');

    question += ` (${prompts.join('/')})`;

    rl.question(question, (answer) => {
        timeout && clearTimeout(timeout);

        switch (answer) {
            case 'y':
            case 'Y':
                opts.yes();
                opts.response && opts.response(answer);
                break;
            case 'n':
            case 'N':
                opts.no();
                opts.response && opts.response(answer);
                break;
            case 'always':
                opts.yes();
                opts.always();
                opts.response && opts.response(answer);
                break;
            case 'never':
                opts.no();
                opts.never();
                opts.response && opts.response(answer);
                break;
            default:
                console.log('Invalid answer');
                askYNquestion(question, opts);
                break;
        }

        rl.close();
    });

    return rl;
}

async function requestPermission(keyName: string, remotePubkey: string, method: string, param?: any): Promise<boolean> {
    const npub = nip19.npubEncode(remotePubkey);

    const promise = new Promise<boolean>((resolve, reject) => {
        const question = `👉 Do you want to allow ${npub} to ${method} with key ${keyName}?`;

        if (method === 'sign_event') {
            const e = param.rawEvent();

            console.log(`👀 Event to be signed\n`, {
                kind: e.kind,
                content: e.content,
                tags: e.tags,
            });
        }

        askYNquestion(question, {
            timeoutLength: 30000,
            yes: () => { resolve(true); },
            no: () => { resolve(false); },
            timeout: () => { console.log('🚫 Timeout reached, denying request.'); resolve(false); },
            always: async () => {
                console.log('✅ Allowing this request and all future requests from this key.');
                await allowAllRequestsFromKey(remotePubkey, keyName, method, param);
            },
            never: async () => {
                console.log('🚫 Denying this request and all future requests from this key.');
                await rejectAllRequestsFromKey(remotePubkey, keyName);
            },
        });
    });

    return promise;
}

function callbackForKey(keyName: string): Nip46PermitCallback {
    return async (remotePubkey: string, method: string, param?: any): Promise<boolean> => {
        try {
            const keyAllowed = await checkIfPubkeyAllowed(keyName, remotePubkey, method, param);

            if (keyAllowed === true || keyAllowed === false) {
                console.log(`🔎 ${nip19.npubEncode(remotePubkey)} is ${keyAllowed ? 'allowed' : 'denied'} to ${method} with key ${keyName}`);
                return keyAllowed;
            }

            // No explicit allow or deny, ask the user
            return requestPermission(keyName, remotePubkey, method, param);
        } catch(e) {
            console.log('callbackForKey error:', e);
        }

        return false;
    };
}