const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, settingsController.getSettings);
router.put('/', authenticateUser, settingsController.updateSettings);

router.post('/api-key', authenticateUser, settingsController.saveApiKey);
router.post('/openrouter/test', authenticateUser, settingsController.testApiKey);
router.delete('/api-key', authenticateUser, settingsController.deleteApiKey);

module.exports = router;
