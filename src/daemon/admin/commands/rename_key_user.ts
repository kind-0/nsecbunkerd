import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";
import prisma from "../../../db.js";

export default async function renameKeyUser(admin: AdminInterface, req: NDKRpcRequest) {
    const [ keyUserPubkey, name ] = req.params as [ string, string ];

    if (!keyUserPubkey || !name) throw new Error("Invalid params");

    const keyUser = await prisma.keyUser.findFirst({
        where: {
            userPubkey: keyUserPubkey,
        }
    });

    if (!keyUser) throw new Error("Key user not found");

    await prisma.keyUser.update({
        where: {
            id: keyUser.id,
        },
        data: {
            description: name,
        }
    });

    const result = JSON.stringify(["ok"]);
    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}
