import "websocket-polyfill";
import NDK, { NDKUser, NDKEvent, NDKPrivateKeySigner, NDKNip46Signer, NostrEvent } from '@nostr-dev-kit/ndk';
import fs from 'fs';

const command = process.argv[2];
let remotePubkey = process.argv[3];
let content = process.argv[4];
const dontPublish = process.argv.includes('--dont-publish');
const debug = process.argv.includes('--debug');
let signer: NDKNip46Signer;
let ndk: NDK;
let remoteUser: NDKUser;

if (!command) {
    console.log('Usage: node src/client.js <command> <remote-npub> <content> [--dont-publish] [--debug] [--pk <key>]');
    console.log('');
    console.log(`\t<command>:          command to run (ping, sign)`);
    console.log(`\t<remote-npub>:      npub that should be published as`);
    console.log(`\t<content>:          sign flow: event JSON to sign (no need for pubkey or id fields) | or kind:1 content string to sign\n`);
    console.log(`\t                    create_account flow: [desired-nip05[,desired-domain,[email]]]`);
    console.log('\t--debug:            enable debug mode');
    process.exit(1);
}

async function createNDK(): Promise<NDK> {
    const ndk = new NDK({
        explicitRelayUrls: ['wss://relay.nsecbunker.com'],
        enableOutboxModel: false
    });
    if (debug) {
        ndk.pool.on('relay:connect', () => console.log('✅ connected'));
        ndk.pool.on('relay:disconnect', () => console.log('❌ disconnected'));
    }
    await ndk.connect(5000);

    return ndk;
}

// switch (command) {
//     case 'ping':
//         ping(remotePubkey);

function getPrivateKeyPath() {
    const home = process.env.HOME || process.env.USERPROFILE;
    return `${home}/.nsecbunker-client-private.key`;
}

function savePrivateKey(pk: string) {
    const path = getPrivateKeyPath();
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
    fs.writeFileSync(`${path}/private.key`, pk);
}

function loadPrivateKey(): string | undefined {
    const path = getPrivateKeyPath();
    if (!fs.existsSync(path)) {
        return undefined;
    }
    return fs.readFileSync(`${path}/private.key`).toString();
}


(async () => {
    let remoteUser: NDKUser;

    // if this is the create_account command and we have something that doesn't look like an npub as the remotePubkey, use NDKUser.fromNip05 to get the npub
    if (command === 'create_account' && !remotePubkey.startsWith("npub")) {
        // see if we have a username@domain
        let [ username, domain ] = remotePubkey.split('@');

        if (!domain) {
            domain = username;
            username = Math.random().toString(36).substring(2, 15);
        }

        content = `${username},${domain}`

        const u = await NDKUser.fromNip05(domain);
        if (!u) {
            console.log(`Invalid nip05 ${remotePubkey}`);
            process.exit(1);
        }
        remoteUser = u;
        remotePubkey = remoteUser.pubkey;
    } else {
        // check if we have a @ so we try to get the npub from nip05
        if (remotePubkey.includes('@')) {
            const u = await NDKUser.fromNip05(remotePubkey);
            if (!u) {
                console.log(`Invalid nip05 ${remotePubkey}`);
                process.exit(1);
            }
            remoteUser = u;
            remotePubkey = remoteUser.pubkey;
        } else {
            remoteUser = new NDKUser({npub: remotePubkey});
        }
    }

    ndk = await createNDK();
    let localSigner: NDKPrivateKeySigner;

    const pk = loadPrivateKey();

    if (pk) {
        localSigner = new NDKPrivateKeySigner(pk);
    } else {
        localSigner = NDKPrivateKeySigner.generate();
        savePrivateKey(localSigner.privateKey!);
    }

    signer = new NDKNip46Signer(ndk, remoteUser.pubkey, localSigner);
    if (debug) console.log(`local pubkey`, (await localSigner.user()).npub);
    if (debug) console.log(`remote pubkey`, remotePubkey);
    ndk.signer = signer;

    signer.on("authUrl", (url) => {
        console.log(`Go to ${url} to authorize this request`);
    });

    switch (command) {
        case "sign": return signFlow();
        case "create_account": return createAccountFlow();
        default:
            console.log(`Unknown command ${command}`);
            process.exit(1);
    }
})();

async function createAccountFlow() {
    const [ username, domain, email ] = content.split(',').map((s) => s.trim());
    try {
        const pubkey = await signer.createAccount(username, domain, email);
        const user = new NDKUser({pubkey});
        console.log(`Hello`, user.npub);
    } catch (e) {
        console.log('error', e);
    }
}

function signFlow() {
    setTimeout(async () => {
        try {
            if (debug) console.log(`waiting for authorization (check your nsecBunker)...`);
            await signer.blockUntilReady();
        } catch(e) {
            console.log('error:', e);
            process.exit(1);
        }
        if (debug) console.log(`authorized to sign as`, remotePubkey);

        let event;

        try {
            const json = JSON.parse(content);
            event = new NDKEvent(ndk, json);
            if (!event.tags) { event.tags = []; }
            if (!event.content) { event.content = ""; }
            if (!event.kind) { throw "No kind on the event to sign!"; }
        } catch (e) {
            event = new NDKEvent(ndk, {
                kind: 1,
                content,
                tags: [
                    ['client', 'nsecbunker-client']
                ],
            } as NostrEvent);
        }

        try {
            await event.sign();
            if (debug) {
                console.log(event.rawEvent());
            } else {
                console.log(event.sig);
            }

            process.exit(0);
        } catch(e) {
            console.log('sign error', e);
        }
    }, 2000);
}