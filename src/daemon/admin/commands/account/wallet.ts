import axios from "axios";
import createDebug from "debug";
import { IWalletConfig, LNBitsWalletConfig } from "../../../../config";

const debug = createDebug("nsecbunker:wallet");

export async function generateWallet(
    walletConfig: IWalletConfig,
    username: string,
    domain: string,
    npub: string
) {
    debug("generateWallet", walletConfig, username, domain, npub);
    if (walletConfig.lnbits) {
        return generateLNBitsWallet(walletConfig.lnbits, username, domain, npub);
    }
}

export async function generateLNBitsWallet(
    lnbitsConfig: LNBitsWalletConfig,
    username: string,
    domain: string,
    npub: string
) {
    debug("generateLNBitsWallet", lnbitsConfig, username, domain, npub);

    const url = new URL(lnbitsConfig.url);
    url.pathname = '/usermanager/api/v1/users';

    const res = await axios.post(url.toString(), {
        user_name: username,
        wallet_name: `${username}@${domain}`,
    }, {
        headers: {
            "X-Api-Key": lnbitsConfig.key,
        },
    });

    const user = res.data;
    const wallet = user.wallets[0];

    debug("lnbits response: ", {status: res.status, data: res.data});

    return await generateLNAddress(
        username,
        domain,
        wallet.inkey,
        npub,
        'lnbits',
        lnbitsConfig.url,
        lnbitsConfig.nostdressUrl,
    );
}

export async function generateLNAddress(
    username: string,
    domain: string,
    userInvoiceKey: string,
    userNpub: string,
    kind: string,
    host: string,
    nostdressUrl: string
) {
    debug("generateLNAddress", username, domain, userInvoiceKey, userNpub, kind, host, nostdressUrl);
    const formData = new URLSearchParams();
    formData.append('name', username);
    formData.append('domain', domain);
    formData.append('kind', kind);
    formData.append('host', host);
    formData.append('key', userInvoiceKey);
    formData.append('pin', ' ');
    formData.append('npub', userNpub);
    formData.append('currentName', ' ');

    const url = new URL(nostdressUrl);
    url.pathname = '/api/easy/';

    debug("nostdress urL: ", url.toString());

    const res = await axios.post(url.toString(), formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    debug("nostdress response: ", res.data);

    return `${username}@${domain}`;
}