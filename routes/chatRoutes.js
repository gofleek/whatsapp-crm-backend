const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', chatController.getChats); // role-filtered inside controller
router.get('/:id', chatController.getChatById);
router.patch('/assign', requireRole('admin', 'traffic_manager'), chatController.assignChat);
router.patch('/status', chatController.updateChatStatus); // role-checked inside controller

module.exports = router;
