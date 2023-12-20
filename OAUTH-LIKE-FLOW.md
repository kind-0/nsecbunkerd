# OAuth-like flow

The OAuth-like flow is a way to create new users in the bunker.

The goal of this flow is to provide a flow that is familiar for new users that are not familiar with key management and that doesn't requrie installing extensions.

The way it works is, a new user without a nostr account goes to an client that implements this flow, when they click register the following happen:

* the client should ask for the user desired NIP-05.
    * to accomplish this, the client can hardcode using their own backend or they can use NIP-89 to find nsecbunker providers.
    * if using non-trusted (i.e. from NIP-89) the client should validate that the bunker's pubkey `kind:0` has a valid NIP-05 with the `_@domain` identifier.
* the client generates a local key and stores it in the user's device. **This is the local key the client will use to sign on behalf of the user**
* the client uses this key to send an `create_account` command to the selected bunker:
```json
{
    "content": nip04_encrypt("{
        method: "create_account",
        params: [
            {
                email: "<optional-email-to-identify-the-user>",
                username: "<desired-username>",
                domain: "<desired-nip05-domain>" // it should be available in this bunker
            }
        ]
    }")
}
```
* the bunker might reply with an `auth_url` response. The client opens this URL. The client might include a `redirect_uri` parameter where the user should be redirected to.
* after signup/client-authorization the client's `create_account` request will be responded with the new user's pubkey or, if a `redirect_uri` was provided, the user will be redirected to the `redirect_uri` with the new user's pubkey as a query string parameter (`pubkey`).
    * in this screen the client can issue a `connect` NIP-46 request to the user's pubkey to verify that everything is working.

## NIP-05
In the background, the bunker will have configured the requested NIP-05 mapping so that the user can use this nostr address to login next time.

## NIP-47
To complete the experience, allowing new users to have a LN wallet immmediately available is very interesting. The bunker can optionally create an LNBits-backed wallet with zapping capabilities.