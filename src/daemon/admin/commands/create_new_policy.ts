import { NDKRpcRequest } from "@nostr-dev-kit/ndk";
import AdminInterface from "../index.js";
import prisma from "../../../db.js";

export default async function createNewPolicy(admin: AdminInterface, req: NDKRpcRequest) {
    const [ _policy ] = req.params as [ string ];

    if (!_policy) throw new Error("Invalid params");

    const policy = JSON.parse(_policy);

    const policyRecord = await prisma.policy.create({
        data: {
            name: policy.name,
            expiresAt: policy.expires_at,
        }
    });

    for (const rule of policy.rules) {
        await prisma.policyRule.create({
            data: {
                policyId: policyRecord.id,
                kind: rule.kind.toString(),
                method: rule.method,
                maxUsageCount: rule.use_count,
                currentUsageCount: 0,
            }
        });
    }

    const result = JSON.stringify(["ok"]);
    return admin.rpc.sendResponse(req.id, req.pubkey, result, 24134);
}