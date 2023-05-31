import { readFileSync, writeFileSync } from 'fs';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { IAdminOpts } from '../daemon/admin';

const generatedKey = NDKPrivateKeySigner.generate();

export interface IConfig {
    nostr: {
        relays: string[];
    };
    admin: IAdminOpts;
    database: string;
    logs: string;
    keys: Record<string, any>;
    verbose: boolean;
}

const defaultConfig: IConfig = {
    nostr: {
        relays: [
            'wss://nos.lol',
            // 'wss://relay.damus.io'
        ]
    },
    admin: {
        npubs: [],
        adminRelays: [
            "wss://nostr.vulpem.com",
            "wss://relay.nsecbunker.com"
        ],
        key: generatedKey.privateKey!
    },
    database: 'sqlite://nsecbunker.db',
    logs: './nsecbunker.log',
    keys: {},
    verbose: false,
};

async function getCurrentConfig(config: string): Promise<IConfig> {
    try {
        const configFileContents = readFileSync(config, 'utf8');
        return JSON.parse(configFileContents);
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            await saveCurrentConfig(config, defaultConfig);
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

export {getCurrentConfig};