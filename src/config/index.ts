import { readFileSync, writeFileSync } from 'fs';
import { NDKPrivateKeySigner, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { IAdminOpts } from '../daemon/admin';

import { version } from '../../package.json';

const generatedKey = NDKPrivateKeySigner.generate();

export type LNBitsWalletConfig = {
    url: string,
    key: string,
    nostdressUrl: string,
}

export interface IWalletConfig {
    lnbits?: LNBitsWalletConfig;
}

export interface DomainConfig {
    nip05: string;
    wallet?: IWalletConfig;
    defaultProfile?: Record<string, string>;
};

export interface IConfig {
    nostr: {
        relays: string[];
    };
    admin: IAdminOpts;
    authPort?: number;
    database: string;
    logs: string;
    keys: Record<string, any>;
    baseUrl?: string;
    verbose: boolean;
    domains?: Record<string, DomainConfig>;
}

const defaultConfig: IConfig = {
    nostr: {
        relays: [
            'wss://relay.damus.io',
            "wss://relay.nsecbunker.com"
        ]
    },
    authPort: 3000,
    admin: {
        npubs: [],
        adminRelays: [
            "wss://relay.nsecbunker.com"
        ],
        key: generatedKey.privateKey!,
        notifyAdminsOnBoot: true,
    },
    baseUrl: "https://nostr.me",
    database: 'sqlite://nsecbunker.db',
    logs: './nsecbunker.log',
    keys: {},
    verbose: false,
};

async function getCurrentConfig(config: string): Promise<IConfig> {
    try {
        const configFileContents = readFileSync(config, 'utf8');

        // add new config options to the config file
        const currentConfig = JSON.parse(configFileContents);
        currentConfig.version = version;
        currentConfig.admin.notifyAdminsOnBoot ??= true;

        return currentConfig;
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
        currentConfig.version = version;
        const configString = JSON.stringify(currentConfig, null, 2);
        writeFileSync(config, configString);
    } catch (err: any) {
        console.error(`Error writing config file: ${err.message}`);
        process.exit(1); // Kill the process if there is an error parsing the JSON
    }
}

export {getCurrentConfig};