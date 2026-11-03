/* Pure Client-Side OpenRouter API Module (Zero Node.js Required) */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_API_KEY = '';

const API = {
    getApiKey() {
        return localStorage.getItem('openrouter_api_key') || DEFAULT_API_KEY;
    },

    setApiKey(key) {
        if (key && key.trim()) {
            localStorage.setItem('openrouter_api_key', key.trim());
        } else {
            localStorage.removeItem('openrouter_api_key');
        }
    },

    async testApiKey(customKey) {
        const apiKey = customKey || this.getApiKey();
        if (!apiKey) {
            return { valid: false, message: 'No API key provided.' };
        }

        try {
            const res = await fetch(`${OPENROUTER_BASE_URL}/auth/key`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'HTTP-Referer': window.location.origin || 'http://localhost',
                    'X-Title': 'FitUp AI Assistant'
                }
            });

            if (res.ok) {
                const data = await res.json();
                return {
                    valid: true,
                    label: data.data?.label || 'Valid Key',
                    usage: data.data?.usage || 0,
                    limit: data.data?.limit || null
                };
            }

            // Fallback check against models endpoint
            const modelsRes = await fetch(`${OPENROUTER_BASE_URL}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
            });

            if (modelsRes.ok) {
                return { valid: true, message: 'API key validated successfully.' };
            }

            const errData = await modelsRes.json().catch(() => ({}));
            return { valid: false, message: errData.error?.message || `HTTP ${modelsRes.status}` };
        } catch (err) {
            return { valid: false, message: err.message || 'Network error connecting to OpenRouter.' };
        }
    },

    async fetchModels() {
        try {
            const apiKey = this.getApiKey();
            const headers = {
                'HTTP-Referer': window.location.origin || 'http://localhost',
                'X-Title': 'FitUp AI Assistant'
            };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const response = await fetch(`${OPENROUTER_BASE_URL}/models`, { headers });
            if (!response.ok) {
                throw new Error(`OpenRouter HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data && Array.isArray(data.data)) {
                return data.data.map(model => {
                    const provider = model.id.split('/')[0] || 'other';
                    const inputPrice = parseFloat(model.pricing?.prompt || '0') * 1000000;
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
                        supports_tools: Boolean(model.description?.toLowerCase().includes('tool') || model.id.includes('gpt-4') || model.id.includes('claude-3') || model.id.includes('gemini'))
                    };
                });
            }

            throw new Error('Invalid response structure from OpenRouter');
        } catch (err) {
            console.error('Error fetching OpenRouter models:', err);
            throw err;
        }
    },

    /**
     * Browser SSE stream consumer directly calling OpenRouter API
     */
    async streamChat(payload, onChunk, onComplete, onError) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            if (onError) onError(new Error('OpenRouter API key is missing. Please enter your API key in Settings.'));
            return;
        }

        try {
            const openRouterBody = {
                model: payload.model_id || 'openai/gpt-4o-mini',
                messages: payload.messages || [],
                temperature: payload.temperature ?? 0.7,
                max_tokens: payload.max_tokens || 4096,
                top_p: payload.top_p ?? 1.0,
                stream: true
            };

            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'HTTP-Referer': window.location.origin || 'http://localhost',
                    'X-Title': 'FitUp AI Assistant'
                },
                body: JSON.stringify(openRouterBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const msg = errData.error?.message || `OpenRouter Error HTTP ${response.status}`;
                throw new Error(msg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep partial line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) continue;

                    if (trimmed === 'data: [DONE]') {
                        if (onComplete) onComplete(fullText);
                        return;
                    }

                    if (trimmed.startsWith('data: ')) {
                        const jsonStr = trimmed.slice(6);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const contentDelta = parsed.choices?.[0]?.delta?.content || '';
                            if (contentDelta) {
                                fullText += contentDelta;
                                if (onChunk) onChunk(contentDelta, fullText);
                            }
                        } catch (e) {
                            // ignore partial json chunk lines
                        }
                    }
                }
            }

            if (onComplete) onComplete(fullText);
        } catch (err) {
            if (onError) onError(err);
        }
    }
};
