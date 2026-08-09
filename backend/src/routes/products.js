const express = require('express');
const { Op } = require('sequelize');
const { Product, Inventory } = require('../models');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/products?search=&category=
// Search by name/category/rack - used at the counter to quickly locate a product.
router.get('/', async (req, res) => {
  const { search, category } = req.query;
  const where = { retailerId: req.user.retailerId, isActive: true };
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { rackLocation: { [Op.like]: `%${search}%` } },
      { category: { [Op.like]: `%${search}%` } },
    ];
  }
  const products = await Product.findAll({
    where,
    include: [{ model: Inventory }],
    order: [['name', 'ASC']],
  });
  res.json(products);
});

router.get('/:id', async (req, res) => {
  const product = await Product.findOne({
    where: { id: req.params.id, retailerId: req.user.retailerId },
    include: [{ model: Inventory }],
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products - add a new product to the catalog (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, category, rackLocation, costPrice, sellingPrice, expiryDate, lowStockThreshold, quantity } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    const product = await Product.create({
      retailerId: req.user.retailerId,
      name, category, rackLocation,
      costPrice: costPrice || 0,
      sellingPrice: sellingPrice || 0,
      expiryDate: expiryDate || null,
      lowStockThreshold: lowStockThreshold ?? 5,
    });
    await Inventory.create({ productId: product.id, currentQuantity: quantity || 0 });

    const full = await Product.findByPk(product.id, { include: [{ model: Inventory }] });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id - edit product master data (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, retailerId: req.user.retailerId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { name, category, rackLocation, costPrice, sellingPrice, expiryDate, lowStockThreshold, isActive } = req.body;
  await product.update({
    name: name ?? product.name,
    category: category ?? product.category,
    rackLocation: rackLocation ?? product.rackLocation,
    costPrice: costPrice ?? product.costPrice,
    sellingPrice: sellingPrice ?? product.sellingPrice,
    expiryDate: expiryDate ?? product.expiryDate,
    lowStockThreshold: lowStockThreshold ?? product.lowStockThreshold,
    isActive: isActive ?? product.isActive,
  });
  const full = await Product.findByPk(product.id, { include: [{ model: Inventory }] });
  res.json(full);
});

// DELETE /api/products/:id - soft delete (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, retailerId: req.user.retailerId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  await product.update({ isActive: false });
  res.json({ success: true });
});

// POST /api/products/:id/adjust - manual stock correction (admin only, logged)
router.post('/:id/adjust', requireAdmin, async (req, res) => {
  const { StockAdjustment } = require('../models');
  const { quantityChange, reason } = req.body;
  if (!quantityChange || !reason) {
    return res.status(400).json({ error: 'quantityChange and reason are required' });
  }
  const product = await Product.findOne({ where: { id: req.params.id, retailerId: req.user.retailerId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const inventory = await Inventory.findOne({ where: { productId: product.id } });
  const newQty = Math.max(0, inventory.currentQuantity + Number(quantityChange));
  await inventory.update({ currentQuantity: newQty });
  await StockAdjustment.create({
    productId: product.id, userId: req.user.userId,
    quantityChange: Number(quantityChange), reason,
  });
  res.json({ success: true, currentQuantity: newQty });
});

module.exports = router;
