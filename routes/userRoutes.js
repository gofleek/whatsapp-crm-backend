const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

router.use(authenticate);

router.post('/', requireRole('admin'), userController.createUser);
router.get('/', requireRole('admin'), userController.getUsers);
router.patch('/:id', requireRole('admin'), userController.updateUser);

// Available to admin & traffic_manager - needed to populate the "assign to" dropdown
router.get('/list/salesmen', requireRole('admin', 'traffic_manager'), userController.getSalesmen);

module.exports = router;
