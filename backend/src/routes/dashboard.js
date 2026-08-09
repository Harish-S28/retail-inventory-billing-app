const express = require('express');
const { Op } = require('sequelize');
const { Sale, SaleItem, Product, Customer } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }

async function salesSince(retailerId, since) {
  return Sale.findAll({
    where: { retailerId, createdAt: { [Op.gte]: since } },
    include: [{ model: SaleItem, as: 'items', include: [Product] }],
  });
}

function summarize(sales) {
  let revenue = 0, profit = 0, transactions = sales.length, unitsSold = 0;
  const productTotals = {};

  for (const sale of sales) {
    revenue += sale.totalAmount;
    for (const item of sale.items) {
      unitsSold += item.quantitySold;
      const itemRevenue = item.priceAtSale * item.quantitySold;
      const itemCost = item.costAtSale * item.quantitySold;
      profit += (itemRevenue - itemCost);

      const name = item.Product ? item.Product.name : `Product #${item.productId}`;
      if (!productTotals[name]) productTotals[name] = { name, unitsSold: 0, revenue: 0 };
      productTotals[name].unitsSold += item.quantitySold;
      productTotals[name].revenue += itemRevenue;
    }
  }

  const topProducts = Object.values(productTotals).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
  return { revenue: round2(revenue), profit: round2(profit), transactions, unitsSold, topProducts };
}

function round2(n) { return Math.round(n * 100) / 100; }

// GET /api/dashboard/summary
// Returns today / this month / this year rollups plus top products.
router.get('/summary', async (req, res) => {
  const now = new Date();
  const retailerId = req.user.retailerId;

  const [todaySales, monthSales, yearSales] = await Promise.all([
    salesSince(retailerId, startOfDay(now)),
    salesSince(retailerId, startOfMonth(now)),
    salesSince(retailerId, startOfYear(now)),
  ]);

  res.json({
    today: summarize(todaySales),
    thisMonth: summarize(monthSales),
    thisYear: summarize(yearSales),
  });
});

// GET /api/dashboard/trend?range=30 (days)
// Daily revenue series for charting.
router.get('/trend', async (req, res) => {
  const days = Number(req.query.range || 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const sales = await salesSince(req.user.retailerId, since);
  const byDay = {};
  for (const sale of sales) {
    const key = new Date(sale.createdAt).toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + sale.totalAmount;
  }

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, revenue: round2(byDay[key] || 0) });
  }
  res.json(series);
});

// GET /api/dashboard/staff-performance
// Sales totals grouped by staff member (accountability view).
router.get('/staff-performance', async (req, res) => {
  const { User } = require('../models');
  const sales = await Sale.findAll({
    where: { retailerId: req.user.retailerId },
    include: [{ model: SaleItem, as: 'items' }, { model: User, attributes: ['id', 'name', 'role'] }],
  });

  const byStaff = {};
  for (const sale of sales) {
    const key = sale.User ? sale.User.name : `User #${sale.userId}`;
    if (!byStaff[key]) byStaff[key] = { staff: key, transactions: 0, revenue: 0, unitsSold: 0 };
    byStaff[key].transactions += 1;
    byStaff[key].revenue += sale.totalAmount;
    byStaff[key].unitsSold += sale.items.reduce((s, i) => s + i.quantitySold, 0);
  }
  res.json(Object.values(byStaff).map(s => ({ ...s, revenue: round2(s.revenue) })));
});

// GET /api/dashboard/customer-summary?range=today|thisMonth|thisYear
// Known-vs-unknown breakdown for the chosen range, plus the always-current
// (all-time) customer base stats: repeat purchase rate, customer lifetime
// value, and top spenders. Powers both the Customers page report and the
// Dashboard's customer analytics cards.
router.get('/customer-summary', async (req, res) => {
  const now = new Date();
  const retailerId = req.user.retailerId;
  const range = req.query.range || 'thisMonth';
  const since = { today: startOfDay(now), thisMonth: startOfMonth(now), thisYear: startOfYear(now) }[range] || startOfMonth(now);

  const [sales, allCustomers] = await Promise.all([
    Sale.findAll({
      where: { retailerId, createdAt: { [Op.gte]: since } },
      include: [{ model: Customer, attributes: ['id', 'isUnknown'] }],
    }),
    Customer.findAll({ where: { retailerId, isUnknown: false } }),
  ]);

  let knownRevenue = 0, unknownRevenue = 0, knownSalesCount = 0, unknownSalesCount = 0;
  const newCustomerIdsInRange = new Set();
  const activeCustomerIdsInRange = new Set();

  for (const sale of sales) {
    if (sale.Customer?.isUnknown) {
      unknownRevenue += sale.totalAmount;
      unknownSalesCount += 1;
    } else if (sale.Customer) {
      knownRevenue += sale.totalAmount;
      knownSalesCount += 1;
      activeCustomerIdsInRange.add(sale.Customer.id);
    }
  }

  for (const c of allCustomers) {
    if (c.firstPurchaseDate && new Date(c.firstPurchaseDate) >= since) newCustomerIdsInRange.add(c.id);
  }
  const returningCount = [...activeCustomerIdsInRange].filter((id) => !newCustomerIdsInRange.has(id)).length;

  const totalSalesCount = knownSalesCount + unknownSalesCount;
  const totalRevenue = knownRevenue + unknownRevenue;
  const repeatCustomers = allCustomers.filter((c) => c.totalPurchases > 1).length;

  res.json({
    range,
    totalKnownCustomers: allCustomers.length,
    knownSalesCount,
    unknownSalesCount,
    percentUnknownSales: totalSalesCount ? round2((unknownSalesCount / totalSalesCount) * 100) : 0,
    knownRevenue: round2(knownRevenue),
    unknownRevenue: round2(unknownRevenue),
    avgBillValue: totalSalesCount ? round2(totalRevenue / totalSalesCount) : 0,
    newCustomersInRange: newCustomerIdsInRange.size,
    returningCustomersInRange: returningCount,
    repeatPurchaseRate: allCustomers.length ? round2((repeatCustomers / allCustomers.length) * 100) : 0,
    customerLifetimeValue: allCustomers.length ? round2(allCustomers.reduce((s, c) => s + c.totalAmountSpent, 0) / allCustomers.length) : 0,
    topCustomers: [...allCustomers]
      .sort((a, b) => b.totalAmountSpent - a.totalAmountSpent)
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, totalAmountSpent: round2(c.totalAmountSpent), totalPurchases: c.totalPurchases })),
  });
});

// GET /api/dashboard/customer-growth?months=6
// Monthly new-customer acquisition and new-vs-returning active customers,
// for the "Customer Growth" and "Returning vs New Customers" charts.
router.get('/customer-growth', async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24);
  const retailerId = req.user.retailerId;

  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [customers, sales] = await Promise.all([
    Customer.findAll({ where: { retailerId, isUnknown: false } }),
    Sale.findAll({
      where: { retailerId, createdAt: { [Op.gte]: since } },
      include: [{ model: Customer, attributes: ['id', 'isUnknown', 'createdAt'] }],
    }),
  ]);

  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, year: d.getFullYear(), month: d.getMonth() });
  }
  const monthKey = (date) => { const dt = new Date(date); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; };

  const series = buckets.map((b) => {
    const newCustomers = customers.filter((c) => c.createdAt && monthKey(c.createdAt) === b.key).length;

    const activeIds = new Set();
    const newActiveIds = new Set();
    for (const sale of sales) {
      if (!sale.Customer || sale.Customer.isUnknown) continue;
      if (monthKey(sale.createdAt) !== b.key) continue;
      activeIds.add(sale.Customer.id);
      if (sale.Customer.createdAt && monthKey(sale.Customer.createdAt) === b.key) newActiveIds.add(sale.Customer.id);
    }
    const returningCustomers = [...activeIds].filter((id) => !newActiveIds.has(id)).length;

    return { month: b.key, newCustomers, returningCustomers };
  });

  res.json(series);
});

module.exports = router;
