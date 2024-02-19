globalThis.crypto = require('crypto');
import "websocket-polyfill";
import run from './run';
import type {IConfig} from '../config/index';

export type DaemonConfig = IConfig & {
    configFile: string;
    allKeys: Record<string, any>;
};

process.on('message', (config: DaemonConfig) => {
    run(config);
});
