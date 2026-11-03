const { get, all, run, exec } = require('../config/database');
const cryptoService = require('../services/cryptoService');
const openRouterService = require('../services/openRouterService');

/**
 * Helper to retrieve effective API key for user
 */
async function getEffectiveApiKey(userId) {
    const creds = await get('SELECT encrypted_key, iv, auth_tag FROM encrypted_api_credentials WHERE user_id = ?', [userId]);
    if (creds && creds.encrypted_key) {
        const decrypted = cryptoService.decrypt(creds.encrypted_key, creds.iv, creds.auth_tag);
        if (decrypted) return decrypted;
    }
    if (process.env.OPENROUTER_API_KEY) {
        return process.env.OPENROUTER_API_KEY;
    }
    return null;
}

/**
 * Gets conversation list for user
 */
async function getConversations(req, res, next) {
    try {
        const userId = req.user.id;
        const archived = req.query.archived === 'true' ? 1 : 0;
        const projectId = req.query.projectId || null;

        let sql = 'SELECT * FROM conversations WHERE user_id = ? AND is_archived = ?';
        const params = [userId, archived];

        if (projectId) {
            sql += ' AND project_id = ?';
            params.push(projectId);
        }

        sql += ' ORDER BY is_pinned DESC, updated_at DESC';

        const conversations = await all(sql, params);
        res.json({ conversations });
    } catch (err) {
        next(err);
    }
}

/**
 * Get single conversation with message history & attachments
 */
async function getConversation(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const conversation = await get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, userId]);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        const messages = await all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [id]);

        // Attachments for messages
        const messageIds = messages.map(m => m.id);
        let attachmentsMap = {};
        if (messageIds.length > 0) {
            const placeholders = messageIds.map(() => '?').join(',');
            const attachments = await all(`SELECT * FROM attachments WHERE message_id IN (${placeholders})`, messageIds);
            attachments.forEach(att => {
                if (!attachmentsMap[att.message_id]) attachmentsMap[att.message_id] = [];
                attachmentsMap[att.message_id].push(att);
            });
        }

        const enrichedMessages = messages.map(m => ({
            ...m,
            attachments: attachmentsMap[m.id] || []
        }));

        res.json({
            conversation,
            messages: enrichedMessages
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Create a new conversation
 */
async function createConversation(req, res, next) {
    try {
        const userId = req.user.id;
        const { title, model_id, project_id, assistant_id, system_prompt } = req.body;

        const id = 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        const finalTitle = title || 'New Chat';
        const finalModel = model_id || 'openai/gpt-4o-mini';

        await run(`
            INSERT INTO conversations (id, user_id, project_id, assistant_id, title, model_id, system_prompt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, project_id || null, assistant_id || null, finalTitle, finalModel, system_prompt || null]);

        const conversation = await get('SELECT * FROM conversations WHERE id = ?', [id]);
        res.status(201).json({ conversation });
    } catch (err) {
        next(err);
    }
}

/**
 * Update conversation (rename, pin, archive, change model)
 */
async function updateConversation(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, model_id, is_pinned, is_archived } = req.body;

        const conv = await get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, userId]);
        if (!conv) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        await run(`
            UPDATE conversations SET
                title = COALESCE(?, title),
                model_id = COALESCE(?, model_id),
                is_pinned = COALESCE(?, is_pinned),
                is_archived = COALESCE(?, is_archived),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [title, model_id, is_pinned !== undefined ? (is_pinned ? 1 : 0) : null, is_archived !== undefined ? (is_archived ? 1 : 0) : null, id, userId]);

        const updated = await get('SELECT * FROM conversations WHERE id = ?', [id]);
        res.json({ conversation: updated });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete a conversation
 */
async function deleteConversation(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await run('DELETE FROM conversations WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Conversation deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Stream SSE endpoint for AI Chat completions
 */
async function streamChat(req, res, next) {
    try {
        const userId = req.user.id;
        const { conversation_id, message, model_id, system_prompt, attachments, temperature, max_tokens, top_p } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message content cannot be empty.' });
        }

        const apiKey = await getEffectiveApiKey(userId);
        if (!apiKey) {
            return res.status(400).json({
                error: 'OpenRouter API Key missing. Please configure your API key in Settings.'
            });
        }

        let convId = conversation_id;
        let selectedModel = model_id || 'openai/gpt-4o-mini';

        if (!convId) {
            // Auto create new conversation
            convId = 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            const autoTitle = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            await run(`
                INSERT INTO conversations (id, user_id, title, model_id, system_prompt)
                VALUES (?, ?, ?, ?, ?)
            `, [convId, userId, autoTitle, selectedModel, system_prompt || null]);
        } else {
            const existingConv = await get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [convId, userId]);
            if (!existingConv) {
                return res.status(404).json({ error: 'Conversation not found.' });
            }
            if (model_id) selectedModel = model_id;
        }

        // Save User Message
        const userMsgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        await run(`
            INSERT INTO messages (id, conversation_id, user_id, role, content, model_used, status)
            VALUES (?, ?, ?, 'user', ?, ?, 'completed')
        `, [userMsgId, convId, userId, message, selectedModel]);

        // Save attachments if any
        if (Array.isArray(attachments) && attachments.length > 0) {
            for (const att of attachments) {
                const attId = 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
                await run(`
                    INSERT INTO attachments (id, message_id, user_id, file_name, file_path, file_type, file_size, extracted_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [attId, userMsgId, userId, att.file_name, att.file_path || '', att.file_type, att.file_size || 0, att.extracted_text || '']);
            }
        }

        // Prepare conversation history for LLM
        const historyRows = await all('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [convId]);

        const openRouterMessages = [];

        // Add System prompt
        const settings = await get('SELECT default_system_prompt, custom_instructions FROM user_settings WHERE user_id = ?', [userId]);
        let sysPrompt = system_prompt || settings?.default_system_prompt || 'You are a helpful, clever, and articulate AI assistant.';
        if (settings?.custom_instructions) {
            sysPrompt += `\n\nUser Custom Instructions:\n${settings.custom_instructions}`;
        }
        openRouterMessages.push({ role: 'system', content: sysPrompt });

        // Add conversation messages
        for (const row of historyRows) {
            openRouterMessages.push({ role: row.role, content: row.content });
        }

        // Set response headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send conversation & message metadata immediately
        res.write(`data: ${JSON.stringify({
            event: 'start',
            conversation_id: convId,
            user_message_id: userMsgId,
            model_id: selectedModel
        })}\n\n`);

        const assistantMsgId = 'msg-' + (Date.now() + 1) + '-' + Math.random().toString(36).substring(2, 7);

        const openRouterPayload = {
            model: selectedModel,
            messages: openRouterMessages,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens || 4096,
            top_p: top_p ?? 1.0
        };

        // Stream completion
        openRouterService.streamChatCompletion(apiKey, openRouterPayload, res, async (err, fullResponseText) => {
            if (!err && fullResponseText) {
                // Save Assistant Message
                try {
                    await run(`
                        INSERT INTO messages (id, conversation_id, user_id, role, content, model_used, status)
                        VALUES (?, ?, ?, 'assistant', ?, ?, 'completed')
                    `, [assistantMsgId, convId, userId, fullResponseText, selectedModel]);

                    await run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [convId]);
                } catch (saveErr) {
                    console.error('Error saving assistant message to DB:', saveErr);
                }
            } else if (err) {
                console.error('Stream failure:', err.message);
            }
        });

    } catch (err) {
        next(err);
    }
}

module.exports = {
    getConversations,
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    streamChat
};
