const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET is Meta's one-time verification handshake when you save the webhook
// URL in the Meta App Dashboard (Configuration -> Webhooks). Must match
// WHATSAPP_VERIFY_TOKEN in your env vars to whatever you type into that
// dashboard field.
router.get('/whatsapp', webhookController.verifyWebhook);

// POST is where actual incoming messages arrive (and also where the admin
// dashboard's "Simulate Webhook" button posts test messages).
// Intentionally NOT protected by the JWT `authenticate` middleware, since
// Meta calls this directly and has no way to send a JWT.
router.post('/whatsapp', webhookController.receiveMessage);

module.exports = router;
