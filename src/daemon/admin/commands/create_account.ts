import { Hexpubkey, NDKKind, NDKPrivateKeySigner, NDKRpcRequest, NDKUserProfile } from "@nostr-dev-kit/ndk";
import AdminInterface from "..";
import { nip19 } from 'nostr-tools';
import { setupSkeletonProfile } from "../../lib/profile";
import { IConfig, getCurrentConfig, saveCurrentConfig } from "../../../config";
import { readFileSync, writeFileSync } from "fs";
import { allowAllRequestsFromKey } from "../../lib/acl";
import { requestAuthorization } from "../../authorize";
import prisma from "../../../db";

export async function validate(currentConfig, username: string, domain: string, email?: string) {
    if (!username) {
        throw new Error('username is required');
    }

    // make sure we have the domain
    if (!currentConfig.domains[domain]) {
        throw new Error('domain not found');
    }

    // load the current nip05 for the domain
    const nip05s = await getCurrentNip05File(currentConfig, domain);

    if (nip05s.names[username]) {
        throw new Error('username already exists');
    }
}

async function getCurrentNip05File(currentConfig: any, domain: string) {
    const nip05File = currentConfig.domains[domain].nip05;
    const file = readFileSync(nip05File, 'utf8');
    return JSON.parse(file);
}

/**
 * Adds an entry to the nip05 file for the domain
 */
async function addNip05(currentConfig: IConfig, username: string, domain: string, pubkey: Hexpubkey) {
    const currentNip05s = await getCurrentNip05File(currentConfig, domain);
    currentNip05s.names[username] = pubkey;
    currentNip05s.relays ??= {};
    currentNip05s.nip46 ??= {};
    currentNip05s.nip46[username] = currentConfig.nostr.relays;

    // save file
    const nip05File = currentConfig.domains![domain].nip05;
    writeFileSync(nip05File, JSON.stringify(currentNip05s, null, 2));
}

async function validateUsername(username: string | undefined, domain: string, admin: AdminInterface, req: NDKRpcRequest) {
    if (!username || username.length === 0) {
        // create a random username of 10 characters
        username = Math.random().toString(36).substring(2, 15);
    }

    return username;
}

async function validateDomain(domain: string | undefined, admin: AdminInterface, req: NDKRpcRequest) {
    const availableDomains = (await admin.config()).domains;

    if (!availableDomains || Object.keys(availableDomains).length === 0)
        throw new Error('no domains available');

    if (!domain || domain.length === 0) domain = Object.keys(availableDomains)[0];

    // check if the domain is available
    if (!availableDomains[domain]) {
        throw new Error('domain not available');
    }

    return domain;
}

export default async function createAccount(admin: AdminInterface, req: NDKRpcRequest) {
    let [ username, domain, email ] = req.params as [ string?, string?, string? ];

    try {
        domain = await validateDomain(domain, admin, req);
        username = await validateUsername(username, domain, admin, req);
    } catch (e: any) {
        admin.rpc.sendResponse(req.id, req.pubkey, "error", NDKKind.NostrConnectAdmin, e.message);
        return;
    }

    const nip05 = `${username}@${domain}`;
    const payload: string[] = [ username, domain ];
    if (email) payload.push(email);

    console.log('requesting authorization', payload);

    const authorizationWithPayload = await requestAuthorization(
        admin,
        nip05,
        req.pubkey,
        req.id,
        req.method,
        JSON.stringify(payload)
    );
    console.log('authorizationWithPayload', authorizationWithPayload);

    if (authorizationWithPayload) {
        const payload = JSON.parse(authorizationWithPayload);
        username = payload[0];
        domain = payload[1];
        email = payload[2];
        return createAccountReal(admin, req, username, domain, email);
    }
}

export async function createAccountReal(
    admin: AdminInterface,
    req: NDKRpcRequest,
    username: string,
    domain: string,
    email?: string
) {
    // Fetch record since the authorization backend might have changed it


    console.log('creating account');
    try {
        const currentConfig = await getCurrentConfig(admin.configFile);

        await validate(currentConfig, username, domain, email);

        const nip05 = `${username}@${domain}`;
        const key = NDKPrivateKeySigner.generate();
        const profile: NDKUserProfile = {
            display_name: username,
            name: username,
            nip05
        };

        setupSkeletonProfile(key, profile, email);
        const generatedUser = await key.user();

        await addNip05(currentConfig, username, domain, generatedUser.pubkey);

        const keyName = nip05;
        const nsec = nip19.nsecEncode(key.privateKey!);
        currentConfig.keys[keyName] = { key: key.privateKey };

        saveCurrentConfig(admin.configFile, currentConfig);

        await admin.loadNsec!(keyName, nsec);

        await prisma.key.create({ data: { keyName, pubkey: generatedUser.pubkey } });

        // Immediately grant access to the creator key
        await grantPermissions(req, keyName);

        return admin.rpc.sendResponse(req.id, req.pubkey, generatedUser.pubkey, NDKKind.NostrConnectAdmin);
    } catch (e: any) {
        console.trace('error', e);
        return admin.rpc.sendResponse(req.id, req.pubkey, "error", NDKKind.NostrConnectAdmin,
            e.message);
    }
}

async function grantPermissions(req: NDKRpcRequest, keyName: string) {
    await allowAllRequestsFromKey(req.pubkey, keyName, "connect");
    await allowAllRequestsFromKey(req.pubkey, keyName, "sign_event", undefined, undefined, { kind: 'all' });
    await allowAllRequestsFromKey(req.pubkey, keyName, "encrypt");
    await allowAllRequestsFromKey(req.pubkey, keyName, "decrypt");
}