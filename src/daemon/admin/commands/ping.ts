import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";

export default async function ping(admin: AdminInterface, req: NDKRpcRequest) {
    return admin.rpc.sendResponse(req.id, req.pubkey, "ok", 24134);
}
