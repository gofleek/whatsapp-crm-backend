const bcrypt = require('bcryptjs');
const { User } = require('../models');

// POST /users  (admin only) - create a user and assign a role
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password, and role are required' });
    }

    if (!['admin', 'traffic_manager', 'salesman'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword, role });

    res.status(201).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, is_active: user.is_active }
    });
  } catch (err) {
    next(err);
  }
};

// GET /users  (admin only) - list all users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

// PATCH /users/:id  (admin only) - update role / is_active / name
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, is_active, name, password } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (role) {
      if (!['admin', 'traffic_manager', 'salesman'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      user.role = role;
    }

    if (typeof is_active === 'boolean') user.is_active = is_active;
    if (name) user.name = name;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, is_active: user.is_active }
    });
  } catch (err) {
    next(err);
  }
};

// GET /users/salesmen  - list active salesmen (used by traffic manager UI for assignment dropdown)
exports.getSalesmen = async (req, res, next) => {
  try {
    const salesmen = await User.findAll({
      where: { role: 'salesman', is_active: true },
      attributes: ['id', 'name', 'email']
    });
    res.json({ success: true, salesmen });
  } catch (err) {
    next(err);
  }
};
