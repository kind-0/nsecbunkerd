import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

function getPassphrase(): string {
    const passwordLength = 32;
    const passwordBytes = randomBytes(passwordLength);
    return passwordBytes.toString('base64').slice(0, passwordLength);
}

const defaultConfig = {
    nostr: {
        relays: [
            'wss://nos.lol',
            // 'wss://relay.damus.io'
        ]
    },
    remote: {
        passphrase: getPassphrase(),
    },
    database: 'sqlite://nsecbunker.db',
    logs: './nsecbunker.log',
    keys: {},
    verbose: false,
};

export function getCurrentConfig(config: string) {
    try {
        const configFileContents = readFileSync(config, 'utf8');
        return JSON.parse(configFileContents);
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            const d = defaultConfig;

            console.log(`nsecBunker generated an admin password for you:\n\n${d.remote.passphrase}\n\n` +
                        `You will need this to manage users of your keys.\n\n`);

            return defaultConfig;
        } else {
            console.error(`Error reading config file: ${err.message}`);
            process.exit(1); // Kill the process if there is an error parsing the JSON
        }
    }
}

export function saveCurrentConfig(config: string, currentConfig: any) {
    try {
        const configString = JSON.stringify(currentConfig, null, 2);
        writeFileSync(config, configString);
    } catch (err: any) {
        console.error(`Error writing config file: ${err.message}`);
        process.exit(1); // Kill the process if there is an error parsing the JSON
    }
}