const openRouterService = require('../services/openRouterService');
const { all, run } = require('../config/database');

async function getModels(req, res, next) {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const models = await openRouterService.fetchModels(forceRefresh);

        // Fetch user's favorite models
        const userId = req.user.id;
        const favorites = await all('SELECT model_id FROM favorite_models WHERE user_id = ? AND is_favorite = 1', [userId]);
        const favSet = new Set(favorites.map(f => f.model_id));

        const enrichedModels = models.map(m => ({
            ...m,
            is_favorite: favSet.has(m.id)
        }));

        res.json({
            count: enrichedModels.length,
            data: enrichedModels
        });
    } catch (err) {
        next(err);
    }
}

async function refreshModels(req, res, next) {
    try {
        const models = await openRouterService.fetchModels(true);
        res.json({ message: 'Model catalog refreshed successfully', count: models.length, data: models });
    } catch (err) {
        next(err);
    }
}

async function toggleFavorite(req, res, next) {
    try {
        const { modelId, isFavorite } = req.body;
        const userId = req.user.id;

        if (!modelId) {
            return res.status(400).json({ error: 'modelId is required.' });
        }

        if (isFavorite) {
            await run('INSERT OR REPLACE INTO favorite_models (user_id, model_id, is_favorite, last_used_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)', [userId, modelId]);
        } else {
            await run('DELETE FROM favorite_models WHERE user_id = ? AND model_id = ?', [userId, modelId]);
        }

        res.json({ message: 'Favorite model status updated', modelId, isFavorite });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getModels,
    refreshModels,
    toggleFavorite
};
