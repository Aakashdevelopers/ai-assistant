const express = require('express');
const router = express.Router();
const modelsController = require('../controllers/modelsController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, modelsController.getModels);
router.post('/refresh', authenticateUser, modelsController.refreshModels);
router.post('/favorite', authenticateUser, modelsController.toggleFavorite);

module.exports = router;
