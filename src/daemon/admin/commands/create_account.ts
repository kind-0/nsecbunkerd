import { Hexpubkey, NDKPrivateKeySigner, NDKRpcRequest, NDKUserProfile } from "@nostr-dev-kit/ndk";
import AdminInterface from "..";
import { nip19 } from 'nostr-tools';
import { setupSkeletonProfile } from "../../lib/profile";
import { IConfig, getCurrentConfig, saveCurrentConfig } from "../../../config";
import { readFileSync, writeFileSync } from "fs";
import { allowAllRequestsFromKey } from "../../lib/acl";
import { requestAuthorization } from "../../authorize";

export async function validate(currentConfig, email: string, username: string, domain: string) {
    if (!email) {
        throw new Error('email is required');
    }

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

    // save file
    const nip05File = currentConfig.domains![domain].nip05;
    writeFileSync(nip05File, JSON.stringify(currentNip05s, null, 2));
}

export default async function createAccount(admin: AdminInterface, req: NDKRpcRequest) {
    const [ payload ] = req.params as [ string ];
    const { email, username, domain } = JSON.parse(payload);
    const nip05 = `${username}@${domain}`;
    if (
        await requestAuthorization(
            admin,
            nip05,
            req.pubkey,
            req.id,
            req.method,
            payload
        )
    ) {
        console.log('authorized');
        return createAccountReal(admin, req);
    }
}

export async function createAccountReal(admin: AdminInterface, req: NDKRpcRequest) {
    try {
        const currentConfig = await getCurrentConfig(admin.configFile);
        const [ payload ] = req.params as [ string ];
        const { email, username, domain } = JSON.parse(payload);

        await validate(currentConfig, email, username, domain);

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

        console.log('saving new key', {keyName, privateKey: key.privateKey});

        saveCurrentConfig(admin.configFile, currentConfig);

        await admin.loadNsec!(keyName, nsec);

        // Immediately grant access to the creator key
        await grantPermissions(req, keyName);

        return admin.rpc.sendResponse(req.id, req.pubkey, JSON.stringify([
            generatedUser.pubkey,

        ]));
    } catch (e: any) {
        console.trace('error', e);
        return admin.rpc.sendResponse(req.id, req.pubkey, JSON.stringify([
            "error",
            e.message
        ]), 24134);
    }
}

async function grantPermissions(req: NDKRpcRequest, keyName: string) {
    await allowAllRequestsFromKey(req.pubkey, keyName, "connect");
    await allowAllRequestsFromKey(req.pubkey, keyName, "sign_event", undefined, undefined, { kind: 'all' });
    await allowAllRequestsFromKey(req.pubkey, keyName, "encrypt");
    await allowAllRequestsFromKey(req.pubkey, keyName, "decrypt");
}