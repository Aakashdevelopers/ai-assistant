const { get, all, run } = require('../config/database');

async function getAssistants(req, res, next) {
    try {
        const userId = req.user.id;
        const assistants = await all('SELECT * FROM custom_assistants WHERE user_id = ? OR is_public = 1 ORDER BY updated_at DESC', [userId]);
        res.json({ assistants });
    } catch (err) {
        next(err);
    }
}

async function createAssistant(req, res, next) {
    try {
        const userId = req.user.id;
        const { name, description, system_prompt, default_model, avatar_icon } = req.body;

        if (!name || !system_prompt) {
            return res.status(400).json({ error: 'Name and System Prompt are required.' });
        }

        const id = 'ast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        await run(`
            INSERT INTO custom_assistants (id, user_id, name, description, system_prompt, default_model, avatar_icon)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, name.trim(), description || null, system_prompt, default_model || null, avatar_icon || 'bot']);

        const assistant = await get('SELECT * FROM custom_assistants WHERE id = ?', [id]);
        res.status(201).json({ assistant });
    } catch (err) {
        next(err);
    }
}

async function updateAssistant(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, description, system_prompt, default_model, avatar_icon } = req.body;

        await run(`
            UPDATE custom_assistants SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                system_prompt = COALESCE(?, system_prompt),
                default_model = COALESCE(?, default_model),
                avatar_icon = COALESCE(?, avatar_icon),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [name, description, system_prompt, default_model, avatar_icon, id, userId]);

        const assistant = await get('SELECT * FROM custom_assistants WHERE id = ?', [id]);
        res.json({ assistant });
    } catch (err) {
        next(err);
    }
}

async function deleteAssistant(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await run('DELETE FROM custom_assistants WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Custom assistant deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAssistants,
    createAssistant,
    updateAssistant,
    deleteAssistant
};
