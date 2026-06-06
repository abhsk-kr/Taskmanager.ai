const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', taskController.list);
router.post('/', taskController.create);
router.patch('/:id', taskController.update);
router.patch('/:id/status', taskController.updateStatus);
router.delete('/:id', taskController.remove);

module.exports = router;