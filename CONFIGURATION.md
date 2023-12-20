# Configuration

nsecbunker.json is a JSON that stores the configuration of the bunker.

## Properties

All properties are optional unless otherwise specified.

`admin.adminRelays`: Relays where the bunker will listen to for admin commands, including for the ability to create new users.

`admin.key`: Private key of the bunker. This is used only for communicating with bunker. It's automatically generated.

`admin.npubs`: Npubs that are allowed to administrate the bunker.

`database`: URI of the database.

`logs`: Path where the logs will be stored.

`verbose`: If true, the bunker will log all messages.

`version`: Version of the bunker. This is automatically generated.

`nostr.relays`: Relays where the bunker will listen to for NIP-46 requests.

### OAuth-like flow properties

`baseUrl`: URL where the bunker can be accessed for OAuth-like authentication. This should be a URL where the bunker can be widely reached.

`authPort`: The port where the bunker will listen for OAuth-like authentication. You should setup a reverse proxy from your main server to this port.

`domains`: Domains that are allowed to create new users from. When a `create_account` is issued the NIP-05 (nostr address) issued should use one of these domains.

`domains.$domain.nip05`: The file pointing to the domain's NIP-05 file.

`keys`: Keys are stored in this object. Encrypted keys are stored as `keys.$keyId.iv` + `keys.$keyId.data`. Unecrypted (recoverable) keys are stored as `keys.$keyId.key`.

