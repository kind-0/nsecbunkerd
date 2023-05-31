import readline from 'readline';

export interface IAskYNquestionOpts {
    timeoutLength?: number;
    yes: any;
    no: any;
    always?: any;
    never?: any;
    response?: any;
    timeout?: any;
}

export async function askYNquestion(
    question: string,
    opts: IAskYNquestionOpts
) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let timeout: NodeJS.Timeout | undefined;

    if (opts.timeoutLength) {
        timeout = setTimeout(() => {
            rl.close();
            opts.timeout && opts.timeout();
        }, opts.timeoutLength);
    }

    const prompts = ['y', 'n'];

    if (opts.always) prompts.push('always');
    if (opts.never) prompts.push('never');

    question += ` (${prompts.join('/')}) `;

    rl.question(question, (answer) => {
        timeout && clearTimeout(timeout);

        switch (answer) {
            case 'y':
            case 'Y':
                opts.yes();
                opts.response && opts.response(answer);
                break;
            case 'n':
            case 'N':
                opts.no();
                opts.response && opts.response(answer);
                break;
            case 'always':
            case 'a':
                opts.yes();
                opts.always();
                opts.response && opts.response(answer);
                break;
            case 'never':
                opts.no();
                opts.never();
                opts.response && opts.response(answer);
                break;
            default:
                console.log('Invalid answer');
                askYNquestion(question, opts);
                break;
        }

        rl.close();
    });

    return rl;
}