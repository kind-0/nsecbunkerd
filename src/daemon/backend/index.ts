import NDK, { NDKNip46Backend, Nip46PermitCallback } from '@nostr-dev-kit/ndk';
import PublishEventHandlingStrategy from './publish-event.js';

export class Backend extends NDKNip46Backend {
    constructor(ndk: NDK, key: string, cb: Nip46PermitCallback) {
        super(ndk, key, cb);
        this.setStrategy('publish_event', new PublishEventHandlingStrategy());
    }
}
