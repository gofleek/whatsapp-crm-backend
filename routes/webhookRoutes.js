const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// NOTE: Real WhatsApp Business API providers (Meta Cloud API, Twilio, etc.)
// call this endpoint directly - it is intentionally NOT protected by the
// JWT `authenticate` middleware. If you want basic protection, set
// WEBHOOK_SECRET in .env and check it here, e.g.:
//
// router.post('/whatsapp', (req, res, next) => {
//   if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
//     return res.status(401).json({ success: false, message: 'Unauthorized' });
//   }
//   next();
// }, webhookController.receiveMessage);

router.post('/whatsapp', webhookController.receiveMessage);

module.exports = router;
