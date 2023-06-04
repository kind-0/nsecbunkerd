import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";
import prisma from "../../../db.js";

export default async function createNewToken(admin: AdminInterface, req: NDKRpcRequest) {
    const [ keyName, clientName, policyId, durationInHours ] = req.params as [ string, string, string, string? ];

    if (!clientName || !policyId) throw new Error("Invalid params");

    const policy = await prisma.policy.findUnique({ where: { id: parseInt(policyId) }, include: { rules: true } });

    if (!policy) throw new Error("Policy not found");

    console.log({clientName, policy, durationInHours});

    const token = [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    const data: any = {
        keyName, clientName, policyId,
        createdBy: req.pubkey,
        token
    };
    if (durationInHours) data.expiresAt = new Date(Date.now() + (parseInt(durationInHours) * 60 * 60 * 1000));

    const tokenRecord = await prisma.token.create({data});

    if (!tokenRecord) throw new Error("Token not created");

    const result = JSON.stringify(["ok"]);
    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}