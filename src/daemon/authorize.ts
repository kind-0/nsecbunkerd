import { Hexpubkey, NDKEvent, NostrEvent } from "@nostr-dev-kit/ndk";
import type { Backend } from "./backend";
import prisma from "../db";
import type { Request } from "@prisma/client";
import AdminInterface from "./admin";
import { IConfig } from "../config";

let baseUrl: string | undefined | null;

/**
 * Attempts to contact an admin to approve this request.
 *
 * Returns a promise that is resolved with true|false when a response has been received.
 */
export async function requestAuthorization(
    admin: AdminInterface,
    keyName: string | undefined,
    remotePubkey: Hexpubkey,
    requestId: string,
    method: string,
    param?: string | NDKEvent
) {
    const request = await createRecord(keyName, requestId, remotePubkey, method, param);

    if (baseUrl === undefined) {
        const config = await admin.config();
        baseUrl = config.baseUrl;
        console.log('baseUrl', baseUrl);
    }

    return new Promise<boolean>((resolve) => {
        if (baseUrl) {
            // If we have a URL, request authorization through web
            urlAuthFlow(baseUrl, admin, remotePubkey, requestId, request, resolve);
        }
        adminAuthFlow(admin, keyName, remotePubkey, method, param, resolve);
    });
}

async function adminAuthFlow(adminInterface, keyName, remotePubkey, method, param, resolve) {
    const requestedPerm = await adminInterface.requestPermission(keyName, remotePubkey, method, param);
    return requestedPerm;
}

async function createRecord(
    keyName: string | undefined,
    requestId: string,
    remotePubkey: string,
    method: string,
    param?: string | NDKEvent,
) {
    console.trace('createRecord', { keyName, requestId, remotePubkey, method, param});

    let params: string | undefined;

    if (param?.rawEvent) {
        const e = param as NDKEvent;
        params = JSON.stringify(e.rawEvent());
    } else if (param) {
        params = param.toString();
    }

    // Create an authorization request record
    const request = await prisma.request.create({
        data: {
            keyName,
            requestId,
            remotePubkey,
            method,
            params
        }
    });
    // Attempt to clean it when it expires
    setTimeout(() => { prisma.request.delete({ where: { id: request.id }}); }, 60000);

    return request;
}

export function urlAuthFlow(
    baseUrl: string,
    admin: AdminInterface,
    remotePubkey: Hexpubkey,
    requestId: string,
    request: Request,
    resolve: any
) {
    const url = generatePendingAuthUrl(baseUrl, request);

    console.log({url});

    admin.rpc.sendResponse(requestId, remotePubkey, "auth_url", undefined, url);

    // Regularly poll to see if this request was approved so we can synchronously resolve
    // the caller. This will feel a bit like magical, where a connection request is created,
    // a popup is opened, the user approves the application, and when the popup closes, the
    // calling function has automatically been approved
    const checkingInterval = setInterval(async () => {
        const record = await prisma.request.findUnique({
            where: { id: request.id }
        });

        if (!record) {
            clearInterval(checkingInterval);
            return;
        }

        if (record.allowed !== undefined && record.allowed !== null) {
            clearInterval(checkingInterval);
            resolve(!!record.allowed);
        }
    }, 100);
}

function generatePendingAuthUrl(baseUrl: string, request: Request): string {
    return [
        baseUrl,
        'requests',
        request.id
    ].join('/');
}