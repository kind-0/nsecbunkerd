import crypto from 'crypto';

export function encryptNsec(nsec: string, passphrase: string): { iv: string, data: string } {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(passphrase).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(nsec);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return {
        iv: iv.toString('hex'),
        data: encrypted.toString('hex'),
    };
}

export function decryptNsec(iv: string, data: string, passphrase: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(passphrase).digest();
    const ivBuffer = Buffer.from(iv, 'hex');
    const dataBuffer = Buffer.from(data, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    let decrypted = decipher.update(dataBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
