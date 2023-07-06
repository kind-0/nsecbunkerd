import NDK, { NDKUser, NDKEvent, NostrEvent } from "@nostr-dev-kit/ndk";

export async function dmUser(ndk: NDK, recipient: NDKUser | string, content: string): Promise<NDKEvent> {
    let targetUser;

    if (typeof recipient === 'string') {
        targetUser = new NDKUser({ npub: recipient });
    } else if (recipient instanceof NDKUser) {
        targetUser = recipient;
    }

    const event = new NDKEvent(ndk, { kind: 4, content } as NostrEvent);
    event.tag(targetUser);
    await event.encrypt(targetUser);
    await event.sign();
    await event.publish();

    return event;
}
