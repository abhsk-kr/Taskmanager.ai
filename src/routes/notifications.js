const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', notificationController.list);
router.patch('/read-all', notificationController.readAll);
router.patch('/:id/read', notificationController.read);

module.exports = router;
