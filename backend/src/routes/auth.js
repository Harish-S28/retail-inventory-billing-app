const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Retailer, User } = require('../models');
const { authenticate, requireAdmin, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, retailerId: user.retailerId, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// POST /api/auth/register-shop
// A new retailer registers their shop. This also creates their own
// "admin" user login in the same step.
router.post('/register-shop', async (req, res) => {
  try {
    const { shopName, email, phone, password } = req.body;
    if (!shopName || !email || !password) {
      return res.status(400).json({ error: 'shopName, email and password are required' });
    }
    const existing = await Retailer.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'A shop is already registered with this email' });

    const retailer = await Retailer.create({
      shopName, email, phone,
      passwordHash: await bcrypt.hash(password, 10),
    });

    const adminUser = await User.create({
      retailerId: retailer.id,
      name: shopName + ' (Owner)',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
    });

    const token = signToken(adminUser);
    res.status(201).json({
      token,
      user: { id: adminUser.id, name: adminUser.name, role: adminUser.role, retailerId: retailer.id, shopName: retailer.shopName },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
// Used by both the owner (admin) and staff accounts.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const retailer = await Retailer.findByPk(user.retailerId);
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, retailerId: user.retailerId, shopName: retailer.shopName },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/staff
// Admin-only: create a restricted staff login for hired labour.
router.post('/staff', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'A user already exists with this email' });

    const staff = await User.create({
      retailerId: req.user.retailerId,
      name, email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'staff',
    });
    res.status(201).json({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/staff - list staff accounts under this shop (admin only)
router.get('/staff', authenticate, requireAdmin, async (req, res) => {
  const staff = await User.findAll({
    where: { retailerId: req.user.retailerId },
    attributes: ['id', 'name', 'email', 'role', 'createdAt'],
  });
  res.json(staff);
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
