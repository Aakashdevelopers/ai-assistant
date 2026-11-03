const https = require('https');
const http = require('http');
const { URL } = require('url');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

let cachedModels = null;
let lastModelFetchTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Helper to execute HTTP/HTTPS requests
 */
function makeHttpRequest(urlString, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlString);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = protocol.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // return raw string if not JSON
                }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
                } else {
                    const errorMsg = (parsed && parsed.error && parsed.error.message)
                        ? parsed.error.message
                        : `HTTP Error ${res.statusCode}: ${data}`;
                    const err = new Error(errorMsg);
                    err.statusCode = res.statusCode;
                    err.responseBody = parsed;
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (body) {
            const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
            req.write(bodyStr);
        }

        req.end();
    });
}

/**
 * Fetches models dynamically from OpenRouter API
 */
async function fetchModels(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedModels && (now - lastModelFetchTimestamp < CACHE_TTL_MS)) {
        return cachedModels;
    }

    try {
        const response = await makeHttpRequest(`${OPENROUTER_BASE_URL}/models`, {
            method: 'GET',
            headers: {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'FitUp AI Assistant'
            }
        });

        if (response.data && Array.isArray(response.data.data)) {
            cachedModels = response.data.data.map(model => {
                const provider = model.id.split('/')[0] || 'other';
                const inputPrice = parseFloat(model.pricing?.prompt || '0') * 1000000; // per million tokens
                const outputPrice = parseFloat(model.pricing?.completion || '0') * 1000000;

                return {
                    id: model.id,
                    name: model.name || model.id,
                    description: model.description || '',
                    context_length: model.context_length || 4096,
                    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
                    input_pricing: inputPrice.toFixed(4),
                    output_pricing: outputPrice.toFixed(4),
                    is_free: (parseFloat(model.pricing?.prompt || '0') === 0 && parseFloat(model.pricing?.completion || '0') === 0),
                    supports_vision: Boolean(model.architecture?.modality?.includes('image') || model.id.includes('vision') || model.id.includes('gpt-4o')),
                    supports_tools: Boolean(model.description?.toLowerCase().includes('tool') || model.id.includes('gpt-4') || model.id.includes('claude-3') || model.id.includes('gemini')),
                    top_provider: model.top_provider || {}
                };
            });
            lastModelFetchTimestamp = now;
            return cachedModels;
        }

        throw new Error('Invalid models response structure from OpenRouter');
    } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error.message);
        if (cachedModels) return cachedModels; // fallback to stale cache if available
        throw error;
    }
}

/**
 * Validates an OpenRouter API key
 */
async function testApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return { valid: false, message: 'API Key cannot be empty.' };
    }

    try {
        const res = await makeHttpRequest(`${OPENROUTER_BASE_URL}/auth/key`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'FitUp AI Assistant'
            }
        });

        if (res.data && res.data.data) {
            return {
                valid: true,
                label: res.data.data.label || 'Valid Key',
                usage: res.data.data.usage || 0,
                limit: res.data.data.limit || null,
                is_free_tier: res.data.data.is_free_tier || false
            };
        }
        return { valid: true, message: 'API key validated successfully.' };
    } catch (err) {
        // Fallback test by calling models endpoint with key if auth/key is restricted
        try {
            await makeHttpRequest(`${OPENROUTER_BASE_URL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`
                }
            });
            return { valid: true, message: 'API key validated.' };
        } catch (innerErr) {
            return { valid: false, message: err.message || 'Invalid API Key.' };
        }
    }
}

/**
 * Streams response from OpenRouter API directly to Express SSE response
 */
function streamChatCompletion(apiKey, payload, res, onCompleteCallback) {
    const parsedUrl = new URL(`${OPENROUTER_BASE_URL}/chat/completions`);
    const postData = JSON.stringify({ ...payload, stream: true });

    const reqOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'FitUp AI Assistant',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    let fullText = '';
    let buffer = '';

    const req = https.request(reqOptions, (apiRes) => {
        if (apiRes.statusCode !== 200) {
            let errBody = '';
            apiRes.on('data', chunk => { errBody += chunk; });
            apiRes.on('end', () => {
                let parsedErr;
                try { parsedErr = JSON.parse(errBody); } catch (e) {}
                const errMsg = (parsedErr && parsedErr.error && parsedErr.error.message)
                    ? parsedErr.error.message
                    : `OpenRouter API returned HTTP ${apiRes.statusCode}: ${errBody}`;

                res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
                res.end();
                if (onCompleteCallback) onCompleteCallback(new Error(errMsg), '');
            });
            return;
        }

        apiRes.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep last incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue; // SSE comment or ping

                if (trimmed === 'data: [DONE]') {
                    res.write('data: [DONE]\n\n');
                    if (onCompleteCallback) onCompleteCallback(null, fullText);
                    return;
                }

                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const contentDelta = parsed.choices?.[0]?.delta?.content || '';
                        fullText += contentDelta;
                    } catch (e) {
                        // ignore unparseable chunk lines
                    }
                    res.write(`${line}\n\n`);
                }
            }
        });

        apiRes.on('end', () => {
            if (buffer.trim()) {
                const trimmed = buffer.trim();
                if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                    const jsonStr = trimmed.slice(6);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const contentDelta = parsed.choices?.[0]?.delta?.content || '';
                        fullText += contentDelta;
                    } catch (e) {}
                    res.write(`${trimmed}\n\n`);
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            if (onCompleteCallback) onCompleteCallback(null, fullText);
        });
    });

    req.on('error', (err) => {
        console.error('SSE Proxy Error:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
        if (onCompleteCallback) onCompleteCallback(err, fullText);
    });

    req.write(postData);
    req.end();

    return req;
}/ return request so it can be aborted if user clicks Stop
}

/**
 * Non-streaming chat completion backup
 */
async function getChatCompletion(apiKey, payload) {
    const response = await makeHttpRequest(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'FitUp AI Assistant'
        }
    }, { ...payload, stream: false });

    return response.data;
}

module.exports = {
    fetchModels,
    testApiKey,
    streamChatCompletion,
    getChatCompletion
};
