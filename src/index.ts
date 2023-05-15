#!/usr/bin/env node
import 'websocket-polyfill';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { setup } from './commands/setup.js';
import { addNsec } from './commands/add.js';
import { start } from './commands/start.js';

console.log(`nsecBunker licensed under CC BY-NC-ND 3.0:`);
console.log(`free to use for non-commercial use`);
console.log(`Copyright by pablof7z <npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft> 2023`);
console.log(`Contact for licensing`);
console.log(``);

yargs(hideBin(process.argv))
    .command('setup', 'Setup nsecBunker', () => {}, (argv) => {
        setup(argv.config as string);
    })

    .command('start', 'Start nsecBunker', (yargs) => {
        yargs
            .option('verbose', {
                alias: 'v',
                type: 'boolean',
                description: 'Run with verbose logging',
                default: false,
            })
            .array('key')
            .option('key <name>', {
                type: 'string',
                description: 'Name of key to enable',
            });
    }, (argv) => {
        start({
            keys: argv.key as string[],
            verbose: argv.verbose as boolean,
            config: argv.config as string,

        });
    })

    .command('add', 'Add an nsec', (yargs) => {
        yargs
            .option('name', {
                alias: 'n',
                type: 'string',
                description: 'Name of the nsec',
                demandOption: true,
            });
    }, (argv) => {
        addNsec({
            config: argv.config as string,
            name: argv.name as string
        });
    })

    .options({
        'config': {
            alias: 'c',
            type: 'string',
            description: 'Path to config file',
            default: 'nsecbunker.json',
        },
    })
    .demandCommand(1)
    .parse();



// async function cb(pubkey: string, method: string, param?: any): Promise<boolean> {
//     // check if pubkey is in allowed list file
//     // if not, return false
//     // if yes, return true

//     // read file allowed.json
//     try {
//         const data = fs.readFileSync('config.json', 'utf8');
//         const config = JSON.parse(data);
//         const allowedPubkeys = config.allowedPubkeys || {};
//         console.log('allowedPubkeys', allowedPubkeys, allowedPubkeys[pubkey]);
//         if (allowedPubkeys[pubkey] && allowedPubkeys[pubkey].methods[method]) {
//             console.log(`✅ ${pubkey} is allowed to ${method}`);
//             return true;
//         }
//     } catch(e) {
//         console.log('Error:', e);
//     }

//     console.log(`🚫 ${pubkey} is not allowed to ${method}`);

//     return false;
// }

// (async () => {
//     const ndk = await createNDK();

//     console.log(`NSECBUNKER BOOTING UP`);

//     if (!process.env.PKEY) {
//         console.error('PKEY not set');
//         process.exit(1);
//     }

//     const backend = new Backend(ndk, process.env.PKEY, cb);
//     await backend.start();

//     const npub = backend.localUser?.npub;
//     const hexpubkey = backend.localUser?.hexpubkey();
//     console.log(`NPUB: ${npub}`);
//     console.log(`PUBK: ${hexpubkey}`);
// })();

