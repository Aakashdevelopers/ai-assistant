const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

// Get master encryption key from env or fallback to a default derived key for development
function getMasterKey() {
    const secret = process.env.ENCRYPTION_SECRET || 'fitup-default-master-secret-key-change-in-prod-32bytes!';
    return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts cleartext string using AES-256-GCM
 */
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encryptedKey: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag
    };
}

/**
 * Decrypts ciphertext string using AES-256-GCM
 */
function decrypt(encryptedKey, ivHex, authTagHex) {
    if (!encryptedKey || !ivHex || !authTagHex) return null;
    try {
        const key = getMasterKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        return null;
    }
}

/**
 * Masks API key for safe display in UI (e.g., sk-or-v1-...abcd)
 */
function maskApiKey(key) {
    if (!key || key.length < 8) return '********';
    const start = key.substring(0, 8);
    const end = key.substring(key.length - 4);
    return `${start}...${end}`;
}

module.exports = {
    encrypt,
    decrypt,
    maskApiKey
};
