import NDK, { NDKUser, NDKEvent, NDKPrivateKeySigner, NDKNip46Signer, NostrEvent } from '@nostr-dev-kit/ndk';

const remotePubkey = process.argv[2];
const content = process.argv[3];

if (!content) {
    console.log('Usage: node src/client.js <remote-npub> <content>');
    console.log('');
    console.log(`\t<remote-npub>:      npub that should be published as`);
    console.log(`\t<content>:          event JSON to sign | or kind:1 content string to sign`);
    process.exit(1);
}

async function createNDK(): Promise<NDK> {
    const ndk = new NDK({
        explicitRelayUrls: ['wss://nostr.vulpem.com', "wss://67aee52897df.ngrok.app"],
    });
    ndk.pool.on('relay:connect', () => console.log('✅ connected'));
    ndk.pool.on('relay:disconnect', () => console.log('❌ disconnected'));
    await ndk.connect(5000);

    return ndk;
}

(async () => {
    const remoteUser = new NDKUser({npub: remotePubkey});
    const ndk = await createNDK();
    const localSigner = NDKPrivateKeySigner.generate();
    // const localSigner = new NDKPrivateKeySigner('b8baad35c387d7cf84d52e0958d9a02aff214393a85b0703de4146c7a3697bb3');
    const signer = new NDKNip46Signer(ndk, remoteUser.hexpubkey(), localSigner);
    console.log(`local pubkey`, (await signer.user()).npub);
    console.log(`remote pubkey`, remotePubkey);
    ndk.signer = signer;

    setTimeout(async () => {
        await signer.blockUntilReady();
        console.log(`authorized to sign as`, remotePubkey);

        const event = new NDKEvent(ndk, {
            pubkey: remoteUser.hexpubkey(),
            kind: 1,
            content,
            tags: [
                ['client', 'nsecbunker-client']
            ],
        } as NostrEvent);

        await event.sign();
        console.log('resulting event', JSON.stringify(await event.toNostrEvent()));
        await event.publish();
    }, 2000);
})();