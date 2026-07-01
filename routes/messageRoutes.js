const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/:chat_id', messageController.getMessages);
router.post('/send', messageController.sendMessage);

module.exports = router;
