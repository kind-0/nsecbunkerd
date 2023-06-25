import { NDKNip46Backend } from "@nostr-dev-kit/ndk";
import { IEventHandlingStrategy } from '@nostr-dev-kit/ndk';

export default class PublishEventHandlingStrategy implements IEventHandlingStrategy {
    async handle(backend: NDKNip46Backend, remotePubkey: string, params: string[]): Promise<string|undefined> {
        const event = await backend.signEvent(remotePubkey, params);
        if (!event) return undefined;

        backend.ndk.publish(event);

        return JSON.stringify(await event.toNostrEvent());
    }
}