const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Customer, Sale, SaleItem, Product } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function round2(n) { return Math.round(n * 100) / 100; }

// GET /api/customers?search=
// Lists known customers (the shared "Unknown" record is excluded by default
// since it isn't a real person to browse) so this doubles as the search box
// on the billing screen ("is this customer already known?") and the list
// view on the Customer Management page.
router.get('/', async (req, res) => {
  const { search, includeUnknown } = req.query;
  const where = { retailerId: req.user.retailerId };
  if (!includeUnknown) where.isUnknown = false;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  const customers = await Customer.findAll({
    where,
    order: [['lastPurchaseDate', 'DESC']],
    limit: 100,
  });
  res.json(customers);
});

// GET /api/customers/:id
// Full profile: rolling stats (already on the row), purchase history,
// favorite products (by units bought), and purchase frequency (average
// days between bills) - everything the Customer Management page shows.
router.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ where: { id: req.params.id, retailerId: req.user.retailerId } });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const sales = await Sale.findAll({
    where: { customerId: customer.id },
    include: [{ model: SaleItem, as: 'items', include: [Product] }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  const productTotals = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      const name = item.Product ? item.Product.name : `Product #${item.productId}`;
      if (!productTotals[name]) productTotals[name] = { name, unitsBought: 0, spent: 0 };
      productTotals[name].unitsBought += item.quantitySold;
      productTotals[name].spent += item.priceAtSale * item.quantitySold;
    }
  }
  const favoriteProducts = Object.values(productTotals)
    .sort((a, b) => b.unitsBought - a.unitsBought)
    .slice(0, 5)
    .map((p) => ({ ...p, spent: round2(p.spent) }));

  let avgDaysBetweenPurchases = null;
  if (customer.totalPurchases > 1 && customer.firstPurchaseDate && customer.lastPurchaseDate) {
    const spanDays = (new Date(customer.lastPurchaseDate) - new Date(customer.firstPurchaseDate)) / 86400000;
    avgDaysBetweenPurchases = round2(spanDays / (customer.totalPurchases - 1));
  }

  res.json({
    customer,
    purchaseHistory: sales,
    favoriteProducts,
    avgDaysBetweenPurchases,
  });
});

// PUT /api/customers/:id - edit name/phone (e.g. renaming a customer captured
// during a rushed sale, or adding their phone number later)
router.put('/:id', async (req, res) => {
  const customer = await Customer.findOne({ where: { id: req.params.id, retailerId: req.user.retailerId } });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.isUnknown) return res.status(400).json({ error: 'The Unknown customer record cannot be edited' });

  const { name, phone } = req.body;
  await customer.update({
    name: name?.trim() || customer.name,
    phone: phone !== undefined ? phone : customer.phone,
  });
  res.json(customer);
});

module.exports = router;
