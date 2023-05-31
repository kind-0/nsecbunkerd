#!/usr/bin/env node
import 'websocket-polyfill';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { setup } from './commands/setup.js';
import { addNsec } from './commands/add.js';
import { start } from './commands/start.js';

console.log(`nsecBunker licensed under CC BY-NC-ND 4.0:`);
console.log(`free to use for non-commercial use`);
console.log(`Copyright by pablof7z <pablo@f7z.io> 2023`);
console.log(`Contact for licensing`);
console.log(``);

yargs(hideBin(process.argv))
    .command('setup', 'Setup nsecBunker', {}, (argv) => {
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
            })
            .array('admin')
            .option('admin <npub>', {
                alias: 'a',
                type: 'string',
                description: 'Admin npub',
            });
    }, (argv) => {
        start({
            keys: argv.key as string[],
            verbose: argv.verbose as boolean,
            config: argv.config as string,
            adminNpubs: argv.admin as string[],
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
