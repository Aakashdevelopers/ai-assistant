const { get, all, run } = require('../config/database');

async function getProjects(req, res, next) {
    try {
        const userId = req.user.id;
        const projects = await all('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
        res.json({ projects });
    } catch (err) {
        next(err);
    }
}

async function createProject(req, res, next) {
    try {
        const userId = req.user.id;
        const { name, description, system_prompt, color, icon } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Project name is required.' });
        }

        const id = 'proj-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        await run(`
            INSERT INTO projects (id, user_id, name, description, system_prompt, color, icon)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, name.trim(), description || null, system_prompt || null, color || '#10a37f', icon || 'folder']);

        const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
        res.status(201).json({ project });
    } catch (err) {
        next(err);
    }
}

async function updateProject(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, description, system_prompt, color, icon } = req.body;

        await run(`
            UPDATE projects SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                system_prompt = COALESCE(?, system_prompt),
                color = COALESCE(?, color),
                icon = COALESCE(?, icon),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [name, description, system_prompt, color, icon, id, userId]);

        const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
        res.json({ project });
    } catch (err) {
        next(err);
    }
}

async function deleteProject(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await run('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Project deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getProjects,
    createProject,
    updateProject,
    deleteProject
};
