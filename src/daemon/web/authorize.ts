import prisma from "../../db";
import type { Request } from "@prisma/client";
import { IAllowScope, allowAllRequestsFromKey } from "../lib/acl";

export async function authorizeRequestWebHandler(request, reply) {
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });
    const reqCookies = request.cookies;

    const url = new URL(request.url, `http://${request.headers.host}`);
    const callbackUrl = url.searchParams.get("callbackUrl");

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

        return reply.view("/templates/createAccount.handlebar", { record, email, username, domain, nip05, callbackUrl });
    } else {
        return reply.view("/templates/authorizeRequest.handlebar", { record, email, username, domain, nip05, callbackUrl });
    }
    // return record;
}

export async function processRequestWebHandler(request, reply) {
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
        return { ok: false, error: "Request not found or already processed" };
    }

    await prisma.request.update({
        where: { id: request.params.id },
        data: { allowed: true }
    });

    let createdPubkey: string | undefined;

    // here I need to wait for the account
    createdPubkey = await new Promise((resolve) => {
        const interval = setInterval(async () => {
            const keyName = record.keyName;
            const keyRecord = await prisma.key.findUnique({ where: { keyName } });

            if (keyRecord) {
                console.log(keyRecord);
                clearInterval(interval);
                resolve(keyRecord.pubkey);
            }
        }, 100);
    });

    const body = request.body;
    const callbackUrlString = body.callbackUrl;
    let callbackUrl: string | undefined;

    if (callbackUrlString) {
        const u = new URL(callbackUrlString);

        if (createdPubkey) {
            u.searchParams.append("pubkey", createdPubkey);
            callbackUrl = u.toString();
        }
    }

    // const url = new URL(callbackUrl);

    // add to url a query param with the user's pubkey

    await allowAllRequestsFromKey(
        record.remotePubkey,
        record.keyName,
        record.method,
        undefined,
        undefined,
    );

    // redirect to login page
    if (callbackUrl) {
        return reply
            .view("/templates/redirect.handlebar", { callbackUrl })
            .redirect(callbackUrl);
    }

    return reply.view("/templates/redirect.handlebar", { callbackUrl });
}