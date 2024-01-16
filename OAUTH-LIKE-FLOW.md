# OAuth-like flow

The OAuth-like flow is a way to create new users in the bunker remotely. This is an interesting flow since it allows users to create accounts without having to install an extension nor deal with key management, while retaining the function of interoperability with other NIP-46-supporting clients.

The way it works is, a new user goes to a client that implements this flow, when they click 'register':

* the client asks for the user desired NIP-05.
    * to accomplish this, the client can hardcode using their own backend or they can use NIP-89 to find nsecbunker providers.
    * if using non-trusted (i.e. from NIP-89) the client should validate that the bunker's pubkey `kind:0` has a valid NIP-05 with the `_@domain` identifier.
* the client generates a local key and stores it in the user's device. **This is the local key the client will use to sign on behalf of the user**
* the client uses this key to send a `create_account` command to the selected bunker:
```json
{
    "content": nip04_encrypt("{
        method: "create_account",
        params: [ "username", "domain", "email" ]
    }")
}
```
* the bunker might reply with an `auth_url` response. The client opens this URL. The client might include a `redirect_uri` parameter where the user should be redirected to.
* after signup/client-authorization the client's `create_account` request will be responded with the new user's pubkey or, if a `redirect_uri` was provided, the user will be redirected to the `redirect_uri` with the new user's pubkey as a query string parameter (`pubkey`).
    * in this screen the client can issue a `connect` NIP-46 request to the user's pubkey to verify that everything is working.

## NIP-05
In the background, the bunker will have configured the requested NIP-05 mapping so that the user can use this nostr address to login next time. Bunkers should add a `nip46` entry to the NIP-05 with a mapping of the name to the relays this bunker will listen on.

```json
{
    "names": {
        "_": "<bunker-pubkey>",
        "pablo": "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52",
    },
    "relays": {
        "pablo": [ "wss://nos.lol", "<etc>" ]
    },
    "nip46": {
        "bunker-pubkey": [ "wss://relay.nsecbunker.com" ],
        "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52": [ "wss://relay.nsecbunker.com" ]
    }
}
```

## NIP-89
Bunkers supporting user registration can announce themselves using NIP-89's `kind:31990`. Clients MUST validate that the 31990 is from a pubkey that owns the root NIP-05 of the domain.

```json
{
  "pubkey": "9c1636cda4be9bce36fe06f99f71c21525b109e0f6f206eb7a5f72093ec89f02",
  "kind": 31990,
  "tags": [ [ "k", "24133" ] ],
  "content": "{\"name\":\"Nostr.me\",\"display_name\":\"\",\"nip05\":\"_@nostr.me\",\"picture\":\"\",\"banner\":\"\",\"about\":\"\",\"lud16\":\"\",\"website\":\"https://nostr.me\"}",
}
```

The NIP-05 `_@nostr.me` should be verified by the client before using it.

## NIP-47
To complete the experience, allowing new users to have a LN wallet immmediately available is very interesting. The bunker can optionally create an LNBits-backed wallet with zapping capabilities.

