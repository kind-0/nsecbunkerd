import { NDKEvent } from '@nostr-dev-kit/ndk';
import prisma from '../../../db.js';

export async function checkIfPubkeyAllowed(
    keyName: string,
    remotePubkey: string,
    method: string,
    event?: NDKEvent
): Promise<boolean | undefined> {
    // find KeyUser
    const keyUser = await prisma.keyUser.findUnique({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
    });

    if (!keyUser) {
        return undefined;
    }

    // find SigningCondition
    const signingConditionQuery = requestToSigningConditionQuery(method, event);

    const explicitReject = await prisma.signingCondition.findFirst({
        where: {
            keyUserId: keyUser.id,
            method: '*',
            allowed: false,
        }
    });

    if (explicitReject) {
        console.log(`explicit reject`, explicitReject);
        return false;
    }

    const signingCondition = await prisma.signingCondition.findFirst({
        where: {
            keyUserId: keyUser.id,
            ...signingConditionQuery,
        }
    });

    // if no SigningCondition found, return undefined
    if (!signingCondition) {
        return undefined;
    }

    const allowed = signingCondition.allowed;

    // Check if the key user has been revoked
    if (allowed) {
        const revoked = await prisma.keyUser.findFirst({
            where: {
                id: keyUser.id,
                revokedAt: { not: null },
            }
        });

        if (revoked) {
            return false;
        }
    }

    if (allowed === true || allowed === false) {
        console.log(`found signing condition`, signingCondition);
        return allowed;
    }

    return undefined;
}

export type IAllowScope = {
    kind?: number | 'all';
};

export function requestToSigningConditionQuery(method: string, event?: NDKEvent) {
    const signingConditionQuery: any = { method };

    switch (method) {
        case 'sign_event':
            signingConditionQuery.kind = { in: [ event?.kind?.toString(), 'all' ] };
            break;
    }

    return signingConditionQuery;
}

export function allowScopeToSigningConditionQuery(method: string, scope?: IAllowScope) {
    const signingConditionQuery: any = { method };

    if (scope && scope.kind) {
        signingConditionQuery.kind = scope.kind.toString();
    }

    return signingConditionQuery;
}

export async function allowAllRequestsFromKey(
    remotePubkey: string,
    keyName: string,
    method: string,
    param?: any,
    description?: string,
    allowScope?: IAllowScope,
): Promise<void> {
    try {

        // Upsert the KeyUser with the given remotePubkey
        const upsertedUser = await prisma.keyUser.upsert({
            where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
            update: { },
            create: { keyName, userPubkey: remotePubkey, description },
        });

        // Create a new SigningCondition for the given KeyUser and set allowed to true
        const signingConditionQuery = allowScopeToSigningConditionQuery(method, allowScope);
        await prisma.signingCondition.create({
            data: {
                allowed: true,
                keyUserId: upsertedUser.id,
                ...signingConditionQuery,
                kind: 'all'
            },
        });
    } catch (e) {
        console.log('allowAllRequestsFromKey', e);
    }
}

export async function rejectAllRequestsFromKey(remotePubkey: string, keyName: string): Promise<void> {
    // Upsert the KeyUser with the given remotePubkey
    const upsertedUser = await prisma.keyUser.upsert({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
        update: { },
        create: { keyName, userPubkey: remotePubkey },
    });

    // Create a new SigningCondition for the given KeyUser and set allowed to false
    await prisma.signingCondition.create({
        data: {
            allowed: false,
            keyUserId: upsertedUser.id,
        },
    });
}