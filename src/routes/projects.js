const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', projectController.list);
router.post('/', projectController.create);
router.patch('/:id', projectController.update);
router.delete('/:id', projectController.remove);
router.get('/:id/members', projectController.getMembers);
router.post('/:id/members', projectController.addMember);
router.delete('/:id/members/:userId', projectController.removeMember);

module.exports = router;