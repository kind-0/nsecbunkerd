import prisma from "../../db";
import bcrypt from "bcrypt";
import { IAllowScope, allowAllRequestsFromKey } from "../lib/acl";
import createDebug from "debug";
import { validateRegistration } from "./registration-validations";

const debug = createDebug("nsecbunker:authorize");

/**
 * TODO: This is still nto being used as no JWT is ever created
 */
async function validateAuthCookie(request) {
    const cookies = request.cookies || {};
    const jwt = cookies.jwt;

    if (!jwt) {
        return false;
    }

    const user = await prisma.user.findUnique({
        where: { pubkey: jwt }
    });

    if (!user) {
        return false;
    }

    return true;
}

async function getAndValidateStateOfRequest(request) {
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });

    if (!record || record.allowed !== null) {
        throw new Error("Request not found or already processed");
    }

    return record;
}


/**
 * Generates the view to authorize a request
 */
export async function authorizeRequestWebHandler(request, reply) {
    try {
        const record = await getAndValidateStateOfRequest(request);
        const url = new URL(request.url, `http://${request.headers.host}`);
        const callbackUrl = url.searchParams.get("callbackUrl");
        const baseUrl = new URL(request.url).pathname?.split('/')?.[1]?.replace(/\/+$/, '');

        const method = record.method;
        let nip05: string | undefined;

        debug({callbackUrl})

        if (method === "create_account") {
            const [ username, domain, email ] = JSON.parse(record.params!);
            nip05 = `${username}@${domain}`;

            return reply.view("/templates/createAccount.handlebar", { baseUrl, record, email, username, domain, nip05, callbackUrl });
        } else {
            const authorized = validateAuthCookie(request);
            return reply.view("/templates/authorizeRequest.handlebar", { record, callbackUrl, authorized });
        }
    } catch (error: any) {
        debug(`Error processing request`, error, request);
        return reply.view("/templates/error.handlebar", { error: error.message });
    }
}

/**
 * Validates + authenticates a request POSTed to the authorize endpoint
 */
export async function validateRequest(request, record) {
    if (await validateAuthCookie(request)) {
        debug("Already authenticated");
        return true;
    }

    const keyName = record.keyName;
    const [username, domain] = keyName.split("@");

    if (!username || !domain) {
        throw new Error("Invalid keyName");
    }

    const password = request.body.password;

    const userRecord = await prisma.user.findUnique({
        where: { username, domain }
    });

    if (!userRecord) {
        debug("No user record found");
        throw new Error("No user record found");
    }

    const hashedPassword = userRecord.password;
    const match = await bcrypt.compare(password, hashedPassword);

    if (!match) {
        debug("Provided password didn't match")
        throw new Error("Invalid password");
    }

    return userRecord;
}

export async function processRequestWebHandler(request, reply) {
    const record = await prisma.request.findUnique({
        where: { id: request.params.id }
    });

    if (!record || !record.keyName) {
        return;
    }

    let userRecord;

    try {
        userRecord = await validateRequest(request, record);
    } catch (e: any) {
        reply.status(401);
        reply.type("application/json");
        return reply.send({ ok: false, error: e.message });
    }

    await prisma.request.update({
        where: { id: request.params.id },
        data: { allowed: true }
    });

    let allowScope: IAllowScope | undefined;
    allowScope = {kind: 'all'};

    await allowAllRequestsFromKey(
        record.remotePubkey,
        record.keyName,
        record.method,
        undefined,
        undefined,
        allowScope
    );

    if (record.method === "connect") {
        debug("connect, adding sign_event capability");
        await allowAllRequestsFromKey(
            record.remotePubkey,
            record.keyName,
            "sign_event",
            undefined,
            undefined,
            allowScope
        );
    }

    return { ok: true, pubkey: userRecord.pubkey };
}

export async function processRegistrationWebHandler(request, reply) {
    try {
        const record = await getAndValidateStateOfRequest(request);
        const body = request.body;
        const baseUrl = new URL(request.url).pathname?.split('/')?.[1]?.replace(/\/+$/, '');

        // we serialize the payload again and store it
        // along with the allowed flag
        // so that the original caller can get the current state
        // to be processed
        const payload: string[] = [];
        payload.push(body.username);
        payload.push(body.domain);

        // TODO: validations here
        try {
            await validateRegistration(request, record);
        } catch (e: any) {
            const [ username, domain, email ] = JSON.parse(record.params!);
            const nip05 = `${username}@${domain}`;

            return reply.view("/templates/createAccount.handlebar", { baseUrl, record, email, username, domain, nip05, error: e.message});
        }

        await prisma.request.update({
            where: { id: request.params.id },
            data: { params: JSON.stringify(payload), allowed: true }
        });

        let createdPubkey: string | undefined;

        // here I need to wait for the account
        createdPubkey = await new Promise((resolve) => {
            const interval = setInterval(async () => {
                const keyName = record.keyName;

                if (!keyName) throw new Error("Invalid keyName on generated account");

                const keyRecord = await prisma.key.findUnique({ where: { keyName } });

                if (keyRecord) {
                    console.log(keyRecord);
                    clearInterval(interval);
                    resolve(keyRecord.pubkey);
                }
            }, 100);
        });

        if (!createdPubkey) throw new Error("No pubkey found for keyName");

        await createUserRecord(
            body.username,
            body.domain,
            createdPubkey,
            body.email,
            body.password,
        )

        const callbackUrlString = body.callbackUrl;
        let callbackUrl: string | undefined;

        if (callbackUrlString) {
            const u = new URL(callbackUrlString);

            if (createdPubkey) {
                u.searchParams.append("pubkey", createdPubkey);
                callbackUrl = u.toString();
            }
        }

        await allowAllRequestsFromKey(
            record.remotePubkey,
            record.keyName,
            record.method,
            undefined,
            undefined,
        );

        // redirect to callbackUrl
        if (callbackUrl) {
            return reply
                .view("/templates/redirect.handlebar", { callbackUrl })
                .redirect(callbackUrl);
        }

        return reply.view("/templates/redirect.handlebar", { callbackUrl });
    } catch (error: any) {
        debug(`Error processing registration request`, error, request);
        return reply.view("/templates/error.handlebar", { error: error.message });
    }
}

async function createUserRecord(
    username: string,
    domain: string,
    pubkey: string,
    email: string,
    password: string,
) {

    const hashedPassword = await bcrypt.hash(password, 10);

    debug(`Creating user record for ${username}@${domain}`, {hashedPassword})

    const userRecord = await prisma.user.create({
        data: {
            username,
            domain,
            pubkey,
            email,
            password: hashedPassword,
        }
    });

    return userRecord;
}