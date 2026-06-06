const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', dashboardController.summary);
router.get('/my-tasks', dashboardController.myTasks);
router.get('/overdue', dashboardController.overdue);

module.exports = router;