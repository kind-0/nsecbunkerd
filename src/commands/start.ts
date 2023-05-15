import readline from 'readline';
import { getCurrentConfig } from '../config/index.js';
import { decryptNsec } from '../config/keys.js';
import { fork } from 'child_process';
import { resolve } from 'path';

interface IOpts {
    keys: string[];
    verbose: boolean;
    config: string;
}

export async function start(opts: IOpts) {
    const configData = getCurrentConfig(opts.config);

    if (opts.verbose) {
        configData.verbose = opts.verbose;
    }

    const keys: Record<string, string> = {};

    let keysToStart = opts.keys;

    if (!keysToStart) {
        keysToStart = Object.keys(configData.keys);
    }

    for (const keyName of keysToStart) {
        const nsec = await startKey(keyName, configData.keys[keyName], opts.verbose);

        if (nsec) {
            keys[keyName] = nsec;
        }
    }

    if (Object.keys(keys).length === 0) {
        console.log(`No keys started.`);
        process.exit(1);
    }

    console.log(`nsecBunker starting with keys:`, Object.keys(keys).join(', '));

    configData.keys = keys;

    const daemonProcess = fork(resolve(__dirname, '../daemon/index.js'));
    daemonProcess.send(configData);

    // process.exit(0);
}

interface KeyData {
    iv: string;
    data: string;
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
        rl.question(`Enter passphrase for ${key}: `, (passphrase: string) => {
            try {
                const { iv, data } = keyData;
                const nsec = decryptNsec(iv, data, passphrase);

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
    });
}
