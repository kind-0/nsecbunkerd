import "websocket-polyfill";
import NDK, { NDKEvent, NDKKind, NDKPrivateKeySigner, NDKRpcRequest, NDKRpcResponse, NDKUser, NostrEvent } from '@nostr-dev-kit/ndk';
import { NDKNostrRpc } from '@nostr-dev-kit/ndk';
import { debug } from 'debug';
import { Key, KeyUser } from '../run';
import { allowAllRequestsFromKey } from '../lib/acl/index.js';
import prisma from '../../db';
import createAccount from './commands/create_account';
import ping from './commands/ping.js';
import createNewKey from './commands/create_new_key';
import createNewPolicy from './commands/create_new_policy';
import createNewToken from './commands/create_new_token';
import unlockKey from './commands/unlock_key';
import renameKeyUser from './commands/rename_key_user.js';
import revokeUser from './commands/revoke_user';
import fs from 'fs';
import { validateRequestFromAdmin } from './validations/request-from-admin';
import { dmUser } from '../../utils/dm-user';
import { IConfig, getCurrentConfig } from "../../config";

export type IAdminOpts = {
    npubs: string[];
    adminRelays: string[];
    key: string;
}

// TODO: Move to configuration
const allowNewKeys = true;

/**
 * This class represents the admin interface for the nsecbunker daemon.
 *
 * It provides an interface for a UI to manage the daemon over nostr.
 */
class AdminInterface {
    private npubs: string[];
    private ndk: NDK;
    private signerUser?: NDKUser;
    readonly rpc: NDKNostrRpc;
    readonly configFile: string;
    public getKeys?: () => Promise<Key[]>;
    public getKeyUsers?: (req: NDKRpcRequest) => Promise<KeyUser[]>;
    public unlockKey?: (keyName: string, passphrase: string) => Promise<boolean>;
    public loadNsec?: (keyName: string, nsec: string) => void;

    constructor(opts: IAdminOpts, configFile: string) {
        this.configFile = configFile;
        this.npubs = opts.npubs||[];
        this.ndk = new NDK({
            explicitRelayUrls: opts.adminRelays,
            signer: new NDKPrivateKeySigner(opts.key),
        });
        this.ndk.signer?.user().then((user: NDKUser) => {
            let connectionString = `bunker://${user.npub}`;

            if (opts.adminRelays.length > 0) {
                connectionString += '@' + encodeURIComponent(`${opts.adminRelays.join(',').replace(/wss:\/\//g, '')}`);
            }

            console.log(`\n\nnsecBunker connection string:\n\n${connectionString}\n\n`);

            // write connection string to connection.txt
            fs.writeFileSync('connection.txt', connectionString);

            this.signerUser = user;

            this.connect();

            this.notifyAdminsOfNewConnection(connectionString);
        });

        this.rpc = new NDKNostrRpc(this.ndk, this.ndk.signer!, debug("ndk:rpc"));
    }

    public async config(): Promise<IConfig> {
        return getCurrentConfig(this.configFile);
    }

    private async notifyAdminsOfNewConnection(connectionString: string) {
        const blastrNdk = new NDK({
            explicitRelayUrls: ['wss://blastr.f7z.xyz', 'wss://nostr.mutinywallet.com'],
            signer: this.ndk.signer
        });
        await blastrNdk.connect(2500);

        for (const npub of this.npubs||[]) {
            dmUser(blastrNdk, npub, `nsecBunker has started; use ${connectionString} to connect to it and unlock your key(s)`);
        }
    }

    /**
     * Get the npub of the admin interface.
     */
    public async npub() {
        return (await this.ndk.signer?.user())!.npub;
    }

    private connect() {
        if (this.npubs.length <= 0) {
            console.log(`❌ Admin interface not starting because no admin npubs were provided`);
            return;
        }

        this.ndk.pool.on('relay:connect', () => console.log('✅ nsecBunker Admin Interface ready'));
        this.ndk.pool.on('relay:disconnect', () => console.log('❌ admin disconnected'));
        this.ndk.connect(2500).then(() => {
            // connect for whitelisted admins
            this.rpc.subscribe({
                "kinds": [NDKKind.NostrConnect, 24134 as number],
                "#p": [this.signerUser!.pubkey]
            });

            this.rpc.on('request', (req) => this.handleRequest(req));
        }).catch((err) => {
            console.log('❌ admin connection failed');
            console.log(err);
        });
    }

    private async handleRequest(req: NDKRpcRequest) {
        console.log(`request coming in`, req);
        try {
            await this.validateRequest(req);

            switch (req.method) {
                case 'get_keys': await this.reqGetKeys(req); break;
                case 'get_key_users': await this.reqGetKeyUsers(req); break;
                case 'rename_key_user': await renameKeyUser(this, req); break;
                case 'get_key_tokens': await this.reqGetKeyTokens(req); break;
                case 'revoke_user': await revokeUser(this, req); break;
                case 'create_new_key': await createNewKey(this, req); break;
                case 'create_account': await createAccount(this, req); break;
                case 'ping': await ping(this, req); break;
                case 'unlock_key': await unlockKey(this, req); break;
                case 'create_new_policy': await createNewPolicy(this, req); break;
                case 'get_policies': await this.reqListPolicies(req); break;
                case 'create_new_token': await createNewToken(this, req); break;
                default:
                    console.log(`Unknown method ${req.method}`);
                    return this.rpc.sendResponse(
                        req.id,
                        req.pubkey,
                        JSON.stringify(['error', `Unknown method ${req.method}`]),
                        24134
                    );
            }
        } catch (err: any) {
            console.error(`Error handling request ${req.method}: ${err.message}`, req.params);
            return this.rpc.sendResponse(req.id, req.pubkey, "error", NDKKind.NostrConnectAdmin, err?.message);
        }
    }

    private async validateRequest(req: NDKRpcRequest): Promise<void> {
        // if this request is of type create_account, allow it
        // TODO: require some POW to prevent spam
        if (req.method === 'create_account' && allowNewKeys) {
            console.log(`allowing create_account request`);
            return;
        }

        if (!await validateRequestFromAdmin(req, this.npubs)) {
            throw new Error('You are not designated to administrate this bunker');
        }
    }

    /**
     * Command to list tokens
     */
    private async reqGetKeyTokens(req: NDKRpcRequest) {
        const keyName = req.params[0];
        const tokens = await prisma.token.findMany({
            where: { keyName },
            include: {
                policy: {
                    include: {
                        rules: true,
                    },
                },
                KeyUser: true,
            },
        });

        const keys = await this.getKeys!();
        const key = keys.find((k) => k.name === keyName);

        if (!key || !key.npub) {
            return this.rpc.sendResponse(req.id, req.pubkey, JSON.stringify([]), 24134);
        }

        const npub = key.npub;

        const result = JSON.stringify(tokens.map((t) => {
            return {
                id: t.id,
                key_name: t.keyName,
                client_name: t.clientName,
                token: [ npub, t.token ].join('#'),
                policy_id: t.policyId,
                policy_name: t.policy?.name,
                created_at: t.createdAt,
                updated_at: t.updatedAt,
                expires_at: t.expiresAt,
                redeemed_at: t.redeemedAt,
                redeemed_by: t.KeyUser?.description,
                time_until_expiration: t.expiresAt ? (t.expiresAt.getTime() - Date.now()) / 1000 : null,
            };
        }));

        return this.rpc.sendResponse(req.id, req.pubkey, result, 24134);
    }

    /**
     * Command to list policies
     */
    private async reqListPolicies(req: NDKRpcRequest) {
        const policies = await prisma.policy.findMany({
            include: {
                rules: true,
            },
        });

        const result = JSON.stringify(policies.map((p) => {
            return {
                id: p.id,
                name: p.name,
                description: p.description,
                created_at: p.createdAt,
                updated_at: p.updatedAt,
                expires_at: p.expiresAt,
                rules: p.rules.map((r) => {
                    return {
                        method: r.method,
                        kind: r.kind,
                        max_usage_count: r.maxUsageCount,
                        current_usage_count: r.currentUsageCount,
                    };
                })
            };
        }));

        return this.rpc.sendResponse(req.id, req.pubkey, result, 24134);
    }

    /**
     * Command to fetch keys and their current state
     */
    private async reqGetKeys(req: NDKRpcRequest) {
        if (!this.getKeys) throw new Error('getKeys() not implemented');

        const result = JSON.stringify(await this.getKeys());
        const pubkey = req.pubkey;

        return this.rpc.sendResponse(req.id, pubkey, result, 24134); // 24134
    }

    /**
     * Command to fetch users of a key
     */
    private async reqGetKeyUsers(req: NDKRpcRequest): Promise<void> {
        if (!this.getKeyUsers) throw new Error('getKeyUsers() not implemented');

        const result = JSON.stringify(await this.getKeyUsers(req));
        const pubkey = req.pubkey;

        return this.rpc.sendResponse(req.id, pubkey, result, 24134); // 24134
    }

    /**
     * This function is called when a request is received from a remote user that needs
     * to be approved by the admin interface.
     *
     * @returns true if the request is approved, false if it is denied, undefined if it timedout
     */
    public async requestPermission(
        keyName: string,
        remotePubkey: string,
        method: string,
        param: any
    ): Promise<boolean | undefined> {
        const keyUser = await prisma.keyUser.findUnique({
            where: {
                unique_key_user: {
                    keyName,
                    userPubkey: remotePubkey,
                },
            },
        });

        console.trace({method, param});

        if (method === 'sign_event') {
            const e = param.rawEvent();
            param = JSON.stringify(e);

            console.log(`👀 Event to be signed\n`, {
                kind: e.kind,
                content: e.content,
                tags: e.tags,
            });
        }

        return new Promise((resolve, reject) => {
            console.log(`requesting permission for`, keyName);
            console.log(`remotePubkey`, remotePubkey);
            console.log(`method`, method);
            console.log(`param`, param);
            console.log(`keyUser`, keyUser);

            /**
             * If an admin doesn't respond within 10 seconds, report back to the user that the request timed out
             */
            setTimeout(() => {
                resolve(undefined);
            }, 10000);

            for (const npub of this.npubs) {
                const remoteUser = new NDKUser({npub});
                console.log(`sending request to ${npub}`, remoteUser.pubkey);
                const params = JSON.stringify({
                    keyName,
                    remotePubkey,
                    method,
                    param,
                    description: keyUser?.description,
                });

                this.rpc.sendRequest(
                    remoteUser.pubkey,
                    'acl',
                    [params],
                    24134,
                    (res: NDKRpcResponse) => {
                        this.requestPermissionResponse(
                            remotePubkey,
                            keyName,
                            method,
                            param,
                            resolve,
                            res
                        );
                    }
                );
            }
        });
    }

    public async requestPermissionResponse(
        remotePubkey: string,
        keyName: string,
        method: string,
        param: string,
        resolve: (value: boolean) => void,
        res: NDKRpcResponse
    ) {
        let resObj;
        try {
            resObj = JSON.parse(res.result);
        } catch (e) {
            console.log('error parsing result', e);
            return;
        }

        switch (resObj[0]) {
            case 'always': {
                allowAllRequestsFromKey(
                    remotePubkey,
                    keyName,
                    method,
                    param,
                    resObj[1],
                    resObj[2]
                );
                resolve(true);
                break;
            }
            case 'never': {
                console.log('not implemented');
                break;
            }
            default:
                console.log('request result', res.result);
        }
    }
}

export default AdminInterface;
