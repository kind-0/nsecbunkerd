import readline from 'readline';
import { getCurrentConfig, saveCurrentConfig } from '../config/index.js';
import { decryptNsec } from '../config/keys.js';
import { fork } from 'child_process';
import { resolve } from 'path';

interface IOpts {
    keys: string[];
    verbose: boolean;
    config: string;
    adminNpubs: string[];
}

/**
 * This command starts the nsecbunkerd process with an (optional)
 * admin interface over websockets or redis.
 */
export async function start(opts: IOpts) {
    const configData = await getCurrentConfig(opts.config);

    if (opts.adminNpubs && opts.adminNpubs.length > 0) {
        configData.admin.npubs = opts.adminNpubs;
    }

    await saveCurrentConfig(opts.config, configData);

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
                        process.exit(0);
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
