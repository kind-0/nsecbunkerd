import prisma from "../../db";
import type { Request } from "@prisma/client";
import { IAllowScope, allowAllRequestsFromKey } from "../lib/acl";

export async function authorizeRequestWebHandler(request, reply) {
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });
    const reqCookies = request.cookies;

    const method = record.method;
    let email: string | undefined;
    let username: string | undefined;
    let domain: string | undefined;
    let nip05: string | undefined;

    if (method === "create_account") {
        const payload = JSON.parse(record.params);
        console.log({payload});
        email = payload.email;
        username = payload.username;
        domain = payload.domain;
        nip05 = `${username}@${domain}`;

        return reply.view("/templates/createAccount.handlebar", { record, email, username, domain, nip05 });
    } else {
        return reply.view("/templates/authorizeRequest.handlebar", { record, email, username, domain, nip05 });
    }
    // return record;
}

export async function processRequestWebHandler(request, reply) {
    console.log(request);
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });

    if (!record) {
        return;
    }

    await prisma.request.update({
        where: { id: request.params.id },
        data: { allowed: true }
    });

    let allowScope: IAllowScope | undefined;

    const body = request.body;

    console.log({body});

    // if (body.permissions === 'all') {
        allowScope = {kind: 'all'};
    // }

    console.log({allowScope});

    await allowAllRequestsFromKey(
        record.remotePubkey,
        record.keyName,
        record.method,
        undefined,
        undefined,
        allowScope
    );

    return { ok: true };
}

export async function processRegistrationWebHandler(request, reply) {
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });

    if (!record || record.allowed) {
        return;
    }

    await prisma.request.update({
        where: { id: request.params.id },
        data: { allowed: true }
    });

    const body = request.body;

    console.log({body});

    await allowAllRequestsFromKey(
        record.remotePubkey,
        record.keyName,
        record.method,
        undefined,
        undefined,
    );

    return { ok: true };
}