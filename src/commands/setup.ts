import readline from 'readline';
import { getCurrentConfig, saveCurrentConfig } from '../config/index.js';

export async function setup(config: string) {
    const currentConfig = await getCurrentConfig(config);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(`You need at least one administrator to remotely control nsecBunker. This should probably be your own npub.\n`);

    rl.question(`Enter an administrator npub: `, (npub: string) => {
        currentConfig.admin.npubs.push(npub);

        saveCurrentConfig(config, currentConfig);
        rl.close();

        console.log(`Administrator npub added!`);
    });
}