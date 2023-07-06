import NDK, { NDKUser, NDKEvent, NDKPrivateKeySigner, NDKNip46Signer, NostrEvent } from '@nostr-dev-kit/ndk';
import fs from 'fs';

const command = process.argv[2];
const remotePubkey = process.argv[3];
const content = process.argv[4];
const dontPublish = process.argv.includes('--dont-publish');
const debug = process.argv.includes('--debug');

if (!command) {
    console.log('Usage: node src/client.js <command> <remote-npub> <content> [--dont-publish] [--debug] [--pk <key>]');
    console.log('');
    console.log(`\t<command>:          command to run (ping, sign)`);
    console.log(`\t<remote-npub>:      npub that should be published as`);
    console.log(`\t<content>:          event JSON to sign (no need for pubkey or id fields) | or kind:1 content string to sign`);
    console.log('\t--dont-publish:     do not publish the event to the relay');
    console.log('\t--debug:            enable debug mode');
    process.exit(1);
}

async function createNDK(): Promise<NDK> {
    const ndk = new NDK({
        explicitRelayUrls: ['wss://nostr.vulpem.com', "wss://relay.nsecbunker.com"],
    });
    if (debug) {
        ndk.pool.on('connect', () => console.log('✅ connected'));
        ndk.pool.on('disconnect', () => console.log('❌ disconnected'));
    }
    await ndk.connect(5000);

    return ndk;
}

// switch (command) {
//     case 'ping':
//         ping(remotePubkey);

function getPrivateKeyPath() {
    const home = process.env.HOME || process.env.USERPROFILE;
    return `${home}/.nsecbunker-client-private.key`;
}

function savePrivateKey(pk: string) {
    const path = getPrivateKeyPath();
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
    fs.writeFileSync(`${path}/private.key`, pk);
}

function loadPrivateKey(): string | undefined {
    const path = getPrivateKeyPath();
    if (!fs.existsSync(path)) {
        return undefined;
    }
    return fs.readFileSync(`${path}/private.key`).toString();
}


(async () => {
    const remoteUser = new NDKUser({npub: remotePubkey});
    const ndk = await createNDK();

    const pk = loadPrivateKey();
    let localSigner: NDKPrivateKeySigner;

    if (pk) {
        localSigner = new NDKPrivateKeySigner(pk);
    } else {
        localSigner = NDKPrivateKeySigner.generate();
        savePrivateKey(localSigner.privateKey!);
    }

    const signer = new NDKNip46Signer(ndk, remoteUser.hexpubkey(), localSigner);
    if (debug) console.log(`local pubkey`, (await localSigner.user()).npub);
    if (debug) console.log(`remote pubkey`, remotePubkey);
    ndk.signer = signer;

    setTimeout(async () => {
        try {
            if (debug) console.log(`waiting for authorization (check your nsecBunker)...`);
            await signer.blockUntilReady();
        } catch(e) {
            console.log('error:', e);
            process.exit(1);
        }
        if (debug) console.log(`authorized to sign as`, remotePubkey);

        let event;

        try {
            const json = JSON.parse(content);
            event = new NDKEvent(ndk, json);
            if (!event.tags) { event.tags = []; }
            if (!event.content) { event.content = ""; }
            if (!event.kind) { throw "No kind on the event to sign!"; }
        } catch (e) {
            event = new NDKEvent(ndk, {
                kind: 1,
                content,
                tags: [
                    ['client', 'nsecbunker-client']
                ],
            } as NostrEvent);
        }

        event.pubkey = remoteUser.hexpubkey();

        try {
            await event.sign();
            if (debug) {
                console.log({
                    event: event.rawEvent(),
                    signature: event.sig,
                });
            } else {
                console.log(event.sig);
            }

            if (!dontPublish) {
                await event.publish();
            }

            process.exit(0);
        } catch(e) {
            console.log('sign error', e);
        }
    }, 2000);
})();