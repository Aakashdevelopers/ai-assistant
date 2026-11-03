const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { chatLimiter } = require('../middleware/rateLimiter');

router.get('/conversations', authenticateUser, chatController.getConversations);
router.post('/conversations', authenticateUser, chatController.createConversation);
router.get('/conversations/:id', authenticateUser, chatController.getConversation);
router.patch('/conversations/:id', authenticateUser, chatController.updateConversation);
router.delete('/conversations/:id', authenticateUser, chatController.deleteConversation);

router.post('/stream', authenticateUser, chatLimiter, chatController.streamChat);

module.exports = router;
