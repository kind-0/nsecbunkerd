import run from './run';
import type {IOpts} from './run';

process.on('message', (configData: IOpts) => {
    run(configData);
});
