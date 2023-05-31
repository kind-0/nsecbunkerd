import { NDKPrivateKeySigner, NDKRpcRequest } from "@nostr-dev-kit/ndk";
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