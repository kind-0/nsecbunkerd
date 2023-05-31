import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";

export default async function unlockKey(admin: AdminInterface, req: NDKRpcRequest) {
    const [ keyName, passphrase ] = req.params as [ string, string ];

    if (!keyName || !passphrase) throw new Error("Invalid params");
    if (!admin.unlockKey) throw new Error("No unlockKey method");

    let result;

    try {
        const res = await admin.unlockKey(keyName, passphrase);
        result = JSON.stringify({ success: res });
    } catch (e: any) {
        result = JSON.stringify({ success: false, error: e.message });
    }

    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}