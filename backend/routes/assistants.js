const express = require('express');
const router = express.Router();
const assistantsController = require('../controllers/assistantsController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, assistantsController.getAssistants);
router.post('/', authenticateUser, assistantsController.createAssistant);
router.patch('/:id', authenticateUser, assistantsController.updateAssistant);
router.delete('/:id', authenticateUser, assistantsController.deleteAssistant);

module.exports = router;
