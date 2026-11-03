const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projectsController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/', authenticateUser, projectsController.getProjects);
router.post('/', authenticateUser, projectsController.createProject);
router.patch('/:id', authenticateUser, projectsController.updateProject);
router.delete('/:id', authenticateUser, projectsController.deleteProject);

module.exports = router;
