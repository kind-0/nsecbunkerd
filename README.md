# nsecbunkerd
Daemon to remotely sign nostr events using keys.

## Easy setup via docker

To quickly install `nsecbunkerd` via Docker just run:

### Prepare your config directory
```
mkdir $HOME/.nsecbunker-config
```

### Start nsecbunkerd

```
docker run -d --name nsecbunkerd -v $HOME/.nsecbunker-config:/app/config pablof7z/nsecbunkerd start --admin <your-npub>
docker compose exec nsecbunker npx prisma db push
```

#### Docker-compose
Edit `docker-compose.yml` and add your nostrpublic key in `command` directive, like `start --admin npub1nftkhktqglvcsj5n4wetkpzxpy4e5x78wwj9y9p70ar9u5u8wh6qsxmzqs`

And start the container
```
docker compose up -d
docker exec -i nsecbunkerd npx prisma db push
```


### Get the connection string

```
docker exec nsecbunkerd cat /app/connection.txt
```

nsecBunker will give you a connection string like:

```
bunker://npub1tj2dmc4udvgafxxxxxxxrtgne8j8l6rgrnaykzc8sys9mzfcz@relay.nsecbunker.com
```

You can visit https://app.nsecbunker.com/ to administrate your nsecBunker remotely, or explore `nsecbunkerd`'s CLI
to find the options to add and approve keys from the CLI.

## Hard setup:
(If you installed via docker you don't need to do any of this, skip to the [Configure](#configure) section)

```
git clone <nsecbunkerd-repo>
npm i
npm run build
npx prisma migrate deploy
```

## Configure

### Easy: Remote configuration

Using the connection string you saw before, you can go to https://app.nsecbunker.com and paste your connection string.

Note that ONLY the npub that you designated as an administrator when launching nsecBunker is able to control your nsecBunker. Even if someone sees your connection string, without access to your administrator keys, there's nothing they can do.

### Hard: manual configuration

(If you are using remote configuration you don't need to do any of this)

### Add your nsec to nsecBunker

Here you'll give nsecBunker your nsec. It will ask you for a passphrase to encrypt it on-disk.
The name is an internal name you'll use to refer to this keypair. Choose anything that is useful to you.

```
npm run nsecbunkerd -- add --name <your-key-name>
```

#### Example
```
$ npm run nsecbunkerd -- add --name "Uncomfortable family"

nsecBunker uses a passphrase to encrypt your nsec when stored on-disk.
Every time you restart it, you will need to type in this password.

Enter a passphrase: <enter-your-passphrase-here>
Enter the nsec for Uncomfortable family: <copy-your-nsec-here>
nsecBunker generated an admin password for you:

***************************

You will need this to manage users of your keys.
````

## Start

```
$ npm run nsecbunkerd start
```

## Testing with `nsecbunker-client`

nsecbunker ships with a simple client that can request signatures from an nsecbunkerd:

```
nsecbunker-client sign <target-npub> "hi, I'm signing from the command line with my nsecbunkerd!"
```

# Authors

* [pablof7z](nostr:npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft)
    * npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft

# License

CC BY-NC-ND 4.0
Contact @pablof7z for licensing.
