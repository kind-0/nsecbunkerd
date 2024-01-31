import readline from 'readline';
import { DomainConfig, IConfig, getCurrentConfig, saveCurrentConfig } from '../config/index.js';
import { decryptNsec } from '../config/keys.js';
import { fork } from 'child_process';
import { resolve } from 'path';
import NDK, { NDKAppHandlerEvent, NDKKind, NDKPrivateKeySigner, NDKUser, NostrEvent } from '@nostr-dev-kit/ndk';
import { debug } from 'console';

interface IOpts {
    keys: string[];
    verbose: boolean;
    config: string;
    adminNpubs: string[];
}

async function nip89announcement(configData: IConfig) {
    const domains = configData.domains as Record<string, DomainConfig>;
    if (!domains) return;
    for (const [ domain, config ] of Object.entries(domains)) {
        const hasNip89 = !!config.nip89;
        if (!hasNip89) continue;

        const signer = new NDKPrivateKeySigner(configData.admin.key);
        const signerUser = await signer.user();

        const profile = config.nip89!.profile;
        const relays = config.nip89!.relays;
        const nip05 = `_@${domain}`;

        // make sure the nip05 correctly points to this pubkey
        const uservianip05 = await NDKUser.fromNip05(nip05);
        if (!uservianip05 || uservianip05.pubkey !== signerUser.pubkey) {
            console.log(`❌ ${nip05} does not point to this nsecbunker's key`);
            if (uservianip05) {
                console.log(`${nip05} points to ${uservianip05.pubkey} instead of ${signerUser.pubkey}`)
            } else {
                console.log(`${nip05} needs to point to ${signerUser.pubkey}`)
            }

            continue
        }

        if (!profile) {
            console.log(`❌ No NIP-89 profile in configuration of ${domain}!`);
            continue
        }

        if (!relays || relays.length === 0) {
            console.log(`❌ No relays in NIP-89 configuration of ${domain}!`);
            continue
        }

        const hasWallet = !!config.wallet;
        const hasNostrdress = !!config.wallet?.lnbits?.nostdressUrl;

        const ndk = new NDK({explicitRelayUrls: relays});
        ndk.signer = signer;
        ndk.connect(5000).then(async () => {
            const event = new NDKAppHandlerEvent(ndk, {
                tags: [
                    [ "alt", "This is an nsecBunker announcement" ]
                ]
            } as NostrEvent);

            const operator = config.nip89!.operator;
            if (operator) {
                try {
                    const opUser = new NDKUser({npub: operator});
                    event.tags.push(["p", opUser.pubkey]);
                } catch {}
            }

            try {
                const user = await ndk.signer!.user();
                const existingEvent = await ndk.fetchEvent({
                    authors: [user.pubkey],
                    kinds: [NDKKind.AppHandler],
                    "#k": [NDKKind.NostrConnect.toString()]
                });

                if (existingEvent) {
                    debug(`🔍 Found existing NIP-89 announcement for ${domain}:`, existingEvent.encode());
                    // update existing event
                    const dTag = existingEvent.tagValue("d");
                    event.tags.push(["d", dTag!])
                } else {
                    debug(`🔍 No existing NIP-89 announcement for ${domain} found.`);
                    event.tags.push(["d", NDKKind.NostrConnect.toString()]);
                }

                profile.nip05 = nip05;
                event.content = JSON.stringify(profile);
                event.tags.push(["k", NDKKind.NostrConnect.toString()])
                if (hasWallet && hasNostrdress) {
                    // add wallet and zaps feature tags
                    event.tags.push(["f", "wallet"]);
                    event.tags.push(["f", "zaps"]);
                }
                await event.publish();
                debug(`✅ Published NIP-89 announcement for ${domain}:`, event.encode());
            } catch(e: any) { console.log(`❌ Failed to publish NIP-89 announcement for ${domain}!`, e.message); }
        })
    }
}

/**
 * This command starts the nsecbunkerd process with an (optional)
 * admin interface over websockets or redis.
 */
export async function start(opts: IOpts) {
    const configData = await getCurrentConfig(opts.config);

    console.log(opts)

    if (opts.adminNpubs && opts.adminNpubs.length > 0) {
        configData.admin.npubs = opts.adminNpubs;
        console.log(`✅ adminNpubs: ${opts.adminNpubs}`)
    } else {
        console.log(`❌ no adminNpubs were provided`)
    }

    await saveCurrentConfig(opts.config, configData);

    nip89announcement(configData);

    if (opts.verbose) {
        configData.verbose = opts.verbose;
    }

    const keys: Record<string, string> = {};

    const keysToStart = opts.keys || [];

    for (const keyName of keysToStart) {
        const nsec = await startKey(keyName, configData.keys[keyName], opts.verbose);

        if (nsec) {
            keys[keyName] = nsec;
        }
    }

    const daemonProcess = fork(resolve(__dirname, '../dist/daemon/index.js'));
    daemonProcess.send({
        configFile: opts.config,
        allKeys: configData.keys,
        ...configData,
        keys,
    });
}

interface KeyData {
    // Symmetrically encrypted key
    iv?: string;
    data?: string;

    // Unencrypted key for remotely created keys with recovery option
    key?: string;
}

/**
 * Start a key
 */
async function startKey(key: string, keyData: KeyData, verbose: boolean): Promise<string | undefined> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        if (keyData.iv && keyData.data) {
            rl.question(`Enter passphrase for ${key}: `, (passphrase: string) => {
                try {
                    const { iv, data } = keyData;
                    const nsec = decryptNsec(iv!, data!, passphrase);

                    if (verbose) {
                        console.log(`Starting ${key}...`);
                    }

                    rl.close();

                    resolve(nsec);
                } catch (e: any) {
                    console.log(e.message);
                    process.exit(1);
                }
            });
        } else if (keyData.key) {
            const nsec = keyData.key;

            if (verbose) {
                console.log(`Starting ${key}...`);
            }

            rl.close();

            resolve(nsec);
        }
    });
}
