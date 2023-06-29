import NDK, { NDKEvent, NDKPrivateKeySigner, NDKRelay, NDKRpcRequest, NDKUser, NDKUserProfile, NostrEvent } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";
import { saveEncrypted } from "../../../commands/add.js";
import { nip19 } from 'nostr-tools';

export default async function createNewKey(admin: AdminInterface, req: NDKRpcRequest) {
    const [ keyName, passphrase, _nsec ] = req.params as [ string, string, string? ];

    if (!keyName || !passphrase) throw new Error("Invalid params");
    if (!admin.loadNsec) throw new Error("No unlockKey method");

    let key;

    if (_nsec) {
        key = new NDKPrivateKeySigner(nip19.decode(_nsec).data as string);
    } else {
        key = NDKPrivateKeySigner.generate();

        setupSkeletonProfile(key);

        console.log(`setting up skeleton profile for ${keyName}`);
    }

    const user = await key.user();
    const nsec = nip19.nsecEncode(key.privateKey!);

    await saveEncrypted(
        admin.configFile,
        nsec,
        passphrase,
        keyName
    );

    await admin.loadNsec(keyName, nsec);

    const result = JSON.stringify({
        npub: user.npub,
    });

    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}

const explicitRelayUrls = [
    'wss://purplepag.es',
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://relay.nostr.band',
    'wss://lbrygen.xyz',
    'wss://blastr.f7z.xyz'
];

/**
 * Setup a skeleton profile for a new key since
 * the experience of a completely empty profile
 * is pretty bad when logging in with Coracle
 */
async function setupSkeletonProfile(key: NDKPrivateKeySigner) {
    const user = await key.user();
    const ndk = new NDK({
        explicitRelayUrls,
        signer: key
    });

    await ndk.connect(2500);

    user.profile = {
        name: 'New User via nsecBunker',
        bio: 'This is a skeleton profile. You should edit it.',
        website: 'https://nsecbunkerd.com',
    };
    user.ndk = ndk;

    await user.publish();

    const pablo = new NDKUser({npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft'});
    await user.follow(pablo);

    const relays = new NDKEvent(ndk, {
        kind: 10002,
        tags: [
            ['r', 'wss://purplepag.es'],
            ['r', 'wss://relay.f7z.io'],
            ['r', 'wss://relay.snort.social'],
            ['r', 'wss://relay.damus.io'],
            ['r', 'wss://relay.damus.io'],
        ]
    } as NostrEvent);
    await relays.publish();
}