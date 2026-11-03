const { get, run } = require('../config/database');
const cryptoService = require('../services/cryptoService');
const openRouterService = require('../services/openRouterService');

async function getSettings(req, res, next) {
    try {
        const userId = req.user.id;

        let settings = await get('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        if (!settings) {
            await run('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);
            settings = await get('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        }

        // Check if user has an encrypted API key
        const creds = await get('SELECT encrypted_key, iv, auth_tag FROM encrypted_api_credentials WHERE user_id = ?', [userId]);

        let apiKeyConfigured = false;
        let maskedKey = null;

        if (creds && creds.encrypted_key) {
            const rawKey = cryptoService.decrypt(creds.encrypted_key, creds.iv, creds.auth_tag);
            if (rawKey) {
                apiKeyConfigured = true;
                maskedKey = cryptoService.maskApiKey(rawKey);
            }
        } else if (process.env.OPENROUTER_API_KEY) {
            apiKeyConfigured = true;
            maskedKey = cryptoService.maskApiKey(process.env.OPENROUTER_API_KEY);
        }

        res.json({
            settings: {
                theme: settings?.theme || 'system',
                language: settings?.language || 'en',
                font_size: settings?.font_size || 'medium',
                enter_to_send: Boolean(settings?.enter_to_send),
                default_model: settings?.default_model || 'openai/gpt-4o-mini',
                default_system_prompt: settings?.default_system_prompt || '',
                temperature: settings?.temperature ?? 0.7,
                max_tokens: settings?.max_tokens || 4096,
                top_p: settings?.top_p ?? 1.0,
                streaming_enabled: Boolean(settings?.streaming_enabled),
                custom_instructions: settings?.custom_instructions || ''
            },
            api_key: {
                configured: apiKeyConfigured,
                masked_key: maskedKey
            }
        });
    } catch (err) {
        next(err);
    }
}

async function updateSettings(req, res, next) {
    try {
        const userId = req.user.id;
        const {
            theme, language, font_size, enter_to_send,
            default_model, default_system_prompt, temperature,
            max_tokens, top_p, streaming_enabled, custom_instructions
        } = req.body;

        await run(`
            INSERT INTO user_settings (
                user_id, theme, language, font_size, enter_to_send,
                default_model, default_system_prompt, temperature,
                max_tokens, top_p, streaming_enabled, custom_instructions, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                theme = COALESCE(?, theme),
                language = COALESCE(?, language),
                font_size = COALESCE(?, font_size),
                enter_to_send = COALESCE(?, enter_to_send),
                default_model = COALESCE(?, default_model),
                default_system_prompt = COALESCE(?, default_system_prompt),
                temperature = COALESCE(?, temperature),
                max_tokens = COALESCE(?, max_tokens),
                top_p = COALESCE(?, top_p),
                streaming_enabled = COALESCE(?, streaming_enabled),
                custom_instructions = COALESCE(?, custom_instructions),
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId, theme, language, font_size, enter_to_send ? 1 : 0,
            default_model, default_system_prompt, temperature,
            max_tokens, top_p, streaming_enabled ? 1 : 0, custom_instructions,
            theme, language, font_size, enter_to_send !== undefined ? (enter_to_send ? 1 : 0) : null,
            default_model, default_system_prompt, temperature,
            max_tokens, top_p, streaming_enabled !== undefined ? (streaming_enabled ? 1 : 0) : null, custom_instructions
        ]);

        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        next(err);
    }
}

async function saveApiKey(req, res, next) {
    try {
        const userId = req.user.id;
        const { apiKey } = req.body;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            return res.status(400).json({ error: 'API key is required.' });
        }

        const trimmedKey = apiKey.trim();

        // Validate key with OpenRouter first
        const testResult = await openRouterService.testApiKey(trimmedKey);
        if (!testResult.valid) {
            return res.status(400).json({ error: `API Key validation failed: ${testResult.message}` });
        }

        // Encrypt key at rest
        const enc = cryptoService.encrypt(trimmedKey);

        await run(`
            INSERT INTO encrypted_api_credentials (user_id, encrypted_key, iv, auth_tag, provider, updated_at)
            VALUES (?, ?, ?, ?, 'openrouter', CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                encrypted_key = EXCLUDED.encrypted_key,
                iv = EXCLUDED.iv,
                auth_tag = EXCLUDED.auth_tag,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, enc.encryptedKey, enc.iv, enc.authTag]);

        res.json({
            message: 'API Key validated and stored securely.',
            masked_key: cryptoService.maskApiKey(trimmedKey)
        });
    } catch (err) {
        next(err);
    }
}

async function testApiKey(req, res, next) {
    try {
        const userId = req.user.id;
        const { apiKey } = req.body;

        let keyToTest = apiKey;

        if (!keyToTest) {
            const creds = await get('SELECT encrypted_key, iv, auth_tag FROM encrypted_api_credentials WHERE user_id = ?', [userId]);
            if (creds && creds.encrypted_key) {
                keyToTest = cryptoService.decrypt(creds.encrypted_key, creds.iv, creds.auth_tag);
            } else if (process.env.OPENROUTER_API_KEY) {
                keyToTest = process.env.OPENROUTER_API_KEY;
            }
        }

        if (!keyToTest) {
            return res.status(400).json({ valid: false, error: 'No API key provided or saved.' });
        }

        const result = await openRouterService.testApiKey(keyToTest);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

async function deleteApiKey(req, res, next) {
    try {
        const userId = req.user.id;
        await run('DELETE FROM encrypted_api_credentials WHERE user_id = ?', [userId]);
        res.json({ message: 'Stored API Key removed.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSettings,
    updateSettings,
    saveApiKey,
    testApiKey,
    deleteApiKey
};
