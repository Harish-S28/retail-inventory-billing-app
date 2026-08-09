const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Sale, SaleItem, Product, Inventory, User, Customer } = require('../models');
const { authenticate } = require('../middleware/auth');
const { resolveCustomer, recordPurchaseOnCustomer } = require('../utils/customerHelpers');

const router = express.Router();
router.use(authenticate);

// POST /api/sales
// Body: { paymentMode, items: [{ productId, quantity }], customerId?, customerName?, isUnknown? }
// Creates a bill, deducts stock atomically, writes an immutable sale_items
// record per line for the audit trail, and resolves/creates the customer
// the bill belongs to (or falls back to the shared "Unknown" customer),
// updating that customer's rolling purchase stats in the same transaction.
router.post('/', async (req, res) => {
  const { items, paymentMode, customerId, customerName, isUnknown } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required to bill a sale' });
  }

  const t = await sequelize.transaction();
  try {
    const customer = await resolveCustomer(req.user.retailerId, { customerId, customerName, isUnknown }, t);

    let totalAmount = 0;
    let totalQuantity = 0;
    const resolvedItems = [];

    for (const line of items) {
      const product = await Product.findOne({
        where: { id: line.productId, retailerId: req.user.retailerId },
        transaction: t,
      });
      if (!product) throw new Error(`Product ${line.productId} not found`);

      const inventory = await Inventory.findOne({ where: { productId: product.id }, transaction: t, lock: t.LOCK.UPDATE });
      const qty = Number(line.quantity);
      if (!qty || qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
      if (inventory.currentQuantity < qty) {
        throw new Error(`Not enough stock for "${product.name}" — only ${inventory.currentQuantity} left`);
      }

      await inventory.update({ currentQuantity: inventory.currentQuantity - qty }, { transaction: t });

      const lineTotal = product.sellingPrice * qty;
      totalAmount += lineTotal;
      totalQuantity += qty;
      resolvedItems.push({
        productId: product.id,
        quantitySold: qty,
        priceAtSale: product.sellingPrice,
        costAtSale: product.costPrice,
      });
    }

    const sale = await Sale.create({
      retailerId: req.user.retailerId,
      userId: req.user.userId,
      customerId: customer.id,
      totalAmount,
      paymentMode: paymentMode || 'cash',
    }, { transaction: t });

    for (const item of resolvedItems) {
      await SaleItem.create({ ...item, saleId: sale.id }, { transaction: t });
    }

    await recordPurchaseOnCustomer(customer, { totalAmount, totalQuantity }, t);

    await t.commit();

    const full = await Sale.findByPk(sale.id, {
      include: [
        { model: SaleItem, as: 'items', include: [Product] },
        { model: User, attributes: ['id', 'name', 'role'] },
        { model: Customer, attributes: ['id', 'name', 'isUnknown'] },
      ],
    });
    res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
});

// GET /api/sales?startDate=&endDate=&userId=&productId=&customerId=
// Sales history with filters - lets the retailer check a specific staff
// member's activity, a date range, or one customer's bills.
router.get('/', async (req, res) => {
  const { startDate, endDate, userId, productId, customerId } = req.query;
  const where = { retailerId: req.user.retailerId };
  if (userId) where.userId = userId;
  if (customerId) where.customerId = customerId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59');
  }

  const itemInclude = { model: SaleItem, as: 'items', include: [Product] };
  if (productId) itemInclude.where = { productId };

  const sales = await Sale.findAll({
    where,
    include: [
      itemInclude,
      { model: User, attributes: ['id', 'name', 'role'] },
      { model: Customer, attributes: ['id', 'name', 'isUnknown'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  res.json(sales);
});

module.exports = router;
