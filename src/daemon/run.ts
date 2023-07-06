import NDK, { NDKPrivateKeySigner, Nip46PermitCallback } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { Backend } from './backend/index.js';
import {
    checkIfPubkeyAllowed,
    allowAllRequestsFromKey,
    rejectAllRequestsFromKey
} from './lib/acl/index.js';
import AdminInterface from './admin/index.js';
import { askYNquestion } from '../utils/prompts/boolean.js';
import { IConfig } from '../config/index.js';
import { NDKRpcRequest } from '@nostr-dev-kit/ndk';
import prisma from '../db.js';
import { DaemonConfig } from './index.js';
import { decryptNsec } from '../config/keys.js';

export type Key = {
    name: string;
    npub?: string;
};

export type KeyUser = {
    name: string;
    pubkey: string;
    description?: string;
    createdAt: Date;
    lastUsedAt?: Date;
};

function getKeys(config: DaemonConfig) {
    return async (): Promise<Key[]> => {
        let lockedKeyNames = Object.keys(config.allKeys);
        const keys: Key[] = [];

        for (const [name, nsec] of Object.entries(config.keys)) {
            const hexpk = nip19.decode(nsec).data as string;
            const user = await new NDKPrivateKeySigner(hexpk).user();
            const key = {
                name,
                npub: user.npub,
                userCount: await prisma.keyUser.count({ where: { keyName: name } }),
                tokenCount: await prisma.token.count({ where: { keyName: name } })
            };

            lockedKeyNames = lockedKeyNames.filter((keyName) => keyName !== name);
            keys.push(key);
        }

        for (const name of lockedKeyNames) {
            keys.push({ name });
        }

        return keys;
    };
}

function getKeyUsers(config: IConfig) {
    return async (req: NDKRpcRequest): Promise<KeyUser[]> => {
        const keyUsers: KeyUser[] = [];
        const keyName = req.params[0];

        const users = await prisma.keyUser.findMany({
            where: {
                keyName,
            },
            include: {
                signingConditions: true,
            },
        });

        for (const user of users) {
            const keyUser = {
                id: user.id,
                name: user.keyName,
                pubkey: user.userPubkey,
                description: user.description || undefined,
                createdAt: user.createdAt,
                lastUsedAt: user.lastUsedAt || undefined,
                revokedAt: user.revokedAt || undefined,
                signingConditions: user.signingConditions, // Include signing conditions
            };

            keyUsers.push(keyUser);
        }

        return keyUsers;
    };
}

let requestPermissionMutex = false;

async function requestPermission(keyName: string, remotePubkey: string, method: string, param?: any): Promise<boolean> {
    if (requestPermissionMutex) {
        console.log(`can't process request ${method} because signer is busy`);
        return false;
        // setTimeout(() => {
        //     requestPermission(keyName, remotePubkey, method, param);
        // }, 1000);
        // return;
    }

    requestPermissionMutex = true;

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
            response: () => {
                requestPermissionMutex = false;
            }
        });
    });

    return promise;
}

function callbackForKeyAdminInterface(keyName: string, adminInterface: AdminInterface): Nip46PermitCallback {
    return async (remotePubkey: string, method: string, param?: any): Promise<boolean> => {
        console.log(`🔑 ${keyName} is being requested to ${method} by ${nip19.npubEncode(remotePubkey)}`);

        if (!adminInterface.requestPermission) {
            throw new Error('adminInterface.requestPermission is not defined');
        }

        try {
            const keyAllowed = await checkIfPubkeyAllowed(keyName, remotePubkey, method, param);

            if (keyAllowed === true || keyAllowed === false) {
                console.log(`🔎 ${nip19.npubEncode(remotePubkey)} is ${keyAllowed ? 'allowed' : 'denied'} to ${method} with key ${keyName}`);
                return keyAllowed;
            }

            const requestedPerm = await adminInterface.requestPermission(keyName, remotePubkey, method, param);

            if (requestedPerm === undefined) {
                throw new Error('adminInterface.requestPermission returned undefined');
            }

            return requestedPerm;
        } catch(e) {
            console.log('callbackForKey error:', e);
        }

        return false;
    };
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

export default async function run(config: DaemonConfig) {
    const daemon = new Daemon(config);
    await daemon.start();
}

class Daemon {
    private config: DaemonConfig;
    private activeKeys: Record<string, any>;
    private adminInterface: AdminInterface;
    private ndk: NDK;

    constructor(config: DaemonConfig) {
        this.config = config;
        this.activeKeys = config.keys;
        this.adminInterface = new AdminInterface(config.admin, config.configFile);

        this.adminInterface.getKeys = getKeys(config);
        this.adminInterface.getKeyUsers = getKeyUsers(config);
        this.adminInterface.unlockKey = this.unlockKey.bind(this);
        this.adminInterface.loadNsec = this.loadNsec.bind(this);

        this.ndk = new NDK({
            explicitRelayUrls: config.nostr.relays,
        });
        this.ndk.pool.on('relay:connect', (r) => {
            if (r) {
                console.log(`✅ Connected to ${r.url}`);
            } else {
                console.log('✅ Connected to relays', this.ndk.pool.urls);
            }
        });
        this.ndk.pool.on('notice', (n, r) => { console.log(`👀 Notice from ${r.url}`, n); });

        this.ndk.pool.on('relay:disconnect', (r) => {
            console.log(`🚫 Disconnected from ${r.url}`);
        });

        setInterval(() => {
            const stats = this.ndk.pool.stats();

            console.log(`📡 ${stats.connected} connected, ${stats.disconnected} disconnected, ${stats.connecting} connecting`);
        }, 10000);
    }

    async start() {
        await this.ndk.connect(5000);

        setTimeout(async () => {
            for (const [name, nsec] of Object.entries(this.config.keys)) {
                await this.startKey(name, nsec);
            }

            console.log('✅ nsecBunker ready to serve requests.');
        }, 1000);
    }

    /**
     * Method to start a key's backend
     * @param name Name of the key
     * @param nsec NSec of the key
     */
    async startKey(name: string, nsec: string) {
        const cb = callbackForKeyAdminInterface(name, this.adminInterface);
        const hexpk = nip19.decode(nsec).data as string;
        const backend = new Backend(this.ndk, hexpk, cb);
        await backend.start();
    }

    async unlockKey(keyName: string, passphrase: string): Promise<boolean> {
        const keyData = this.config.allKeys[keyName];
        const { iv, data } = keyData;

        const nsec = decryptNsec(iv, data, passphrase);
        this.activeKeys[keyName] = nsec;

        this.startKey(keyName, nsec);

        return true;
    }

    loadNsec(keyName: string, nsec: string) {
        this.activeKeys[keyName] = nsec;

        this.startKey(keyName, nsec);
    }
}