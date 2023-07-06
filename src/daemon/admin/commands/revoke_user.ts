import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";
import prisma from "../../../db.js";

export default async function revokeUser(admin: AdminInterface, req: NDKRpcRequest) {
    const [ keyUserId ] = req.params as [ string ];

    if (!keyUserId) throw new Error("Invalid params");

    const keyUserIdInt = parseInt(keyUserId);
    if (isNaN(keyUserIdInt)) throw new Error("Invalid params");

    await prisma.keyUser.update({
        where: {
            id: keyUserIdInt,
        },
        data: {
            revokedAt: new Date(),
        }
    });

    const result = JSON.stringify(["ok"]);
    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}
