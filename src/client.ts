import NDK, { NDKEvent, NDKPrivateKeySigner, NDKNip46Signer, NostrEvent } from '@nostr-dev-kit/ndk';

const remotePubkey = process.env.PUBKEY;

if (!remotePubkey) {
    console.log('Usage: PUBKEY=<pubkey> node src/client.js <content>');
    process.exit(1);
}

const pubkey = process.argv[2];
const content = process.argv[3];

if (!content) {
    console.log('Usage: node src/client.js <remote-pubkey> <content>');
    console.log('');
    console.log(`\t<remote-pubkey>:    npub that should be published as`);
    console.log(`\t<content>:          event JSON to sign | or kind:1 content string to sign`);
    process.exit(1);
}

async function createNDK(): Promise<NDK> {
    const ndk = new NDK({
        explicitRelayUrls: ['wss://nos.lol'],
    });
    await ndk.connect(2000);
    ndk.pool.on('connect', () => console.log('✅ connected'));

    return ndk;
}

(async () => {
    const ndk = await createNDK();
    const localSigner = new NDKPrivateKeySigner('9ec8a4b2e1fac9eae616736f718f92ed30c57fc2fff36ef8139e27c31889e327');
    const signer = new NDKNip46Signer(ndk, remotePubkey, localSigner);
    console.log(`local pubkey`, (await signer.user()).npub);
    console.log(`remote pubkey`, remotePubkey);
    ndk.signer = signer;

    setTimeout(async () => {
        await signer.blockUntilReady();
        console.log(`authorized to sign as`, remotePubkey);

        const notPabloEvent = new NDKEvent(ndk, {
            pubkey: remotePubkey,
            kind: 1,
            content,
            tags: [
                ['t', 'grownostr'],
            ],
        } as NostrEvent);

        await notPabloEvent.sign();
        console.log('resulting event', JSON.stringify(await notPabloEvent.toNostrEvent()));
        // await notPabloEvent.publish();
    }, 2000);
})();