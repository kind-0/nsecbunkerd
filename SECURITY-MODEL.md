# Security Model

The premise of nsecBunker is that you can store Nostr private keys (nsecs), use them remotely under certain policies, but these keys can never be exfiltrated from nsecBunker.

All communication with nsecBunker happens through encrypted, ephemeral nostr events.

## Keys
Within nsecBunker there are two distinct sets of keys:

### User keys (aka target keys)
The keys that users want to sign with (e.g. your personal or company's keys).

These keys are stored encrypted with a passphrase; the same way Lightning Network's LND stores keys locally: every time you start nsecBunker, you must enter the passphrase to decrypt it.

Without this passphrase, keys cannot be used.

### nsecBunker's key
nsecBunker generates it's own private key, which is used solely to communicate with the nsecBunker administration UI. If these keys are compromised, no key material is at risk.

To interact with nsecBunker's administration UI, the administrator(s)' keys must be whitelisted within nsecBunker. All communication between the administrator and the nsecBunker is end-to-end encrypted with these two set of keys.

Non-whitelisted keys simply cannot talk to nsecBunker's Administration UI.

## Nostr Connect
nsecBunker listens on certain relays (specified in the config file) for keys that are attempting to sign with the target keys.