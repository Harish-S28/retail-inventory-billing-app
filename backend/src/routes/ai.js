const express = require('express');
const { Op } = require('sequelize');
const { Sale, SaleItem, Product, Inventory, Customer } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function round2(n) { return Math.round(n * 100) / 100; }

async function getContext(retailerId) {
  const now = new Date();
  const [todaySales, monthSales, products, customers] = await Promise.all([
    Sale.findAll({ where: { retailerId, createdAt: { [Op.gte]: startOfDay(now) } }, include: [{ model: SaleItem, as: 'items', include: [Product] }] }),
    Sale.findAll({ where: { retailerId, createdAt: { [Op.gte]: startOfMonth(now) } }, include: [{ model: SaleItem, as: 'items', include: [Product] }] }),
    Product.findAll({ where: { retailerId, isActive: true }, include: [{ model: Inventory }] }),
    Customer.findAll({ where: { retailerId, isUnknown: false }, order: [['totalAmountSpent', 'DESC']], limit: 15 }),
  ]);
  return { todaySales, monthSales, products, customers };
}

function aggregate(sales) {
  let revenue = 0, profit = 0;
  const byProduct = {};
  for (const sale of sales) {
    revenue += sale.totalAmount;
    for (const item of sale.items) {
      const rev = item.priceAtSale * item.quantitySold;
      const cost = item.costAtSale * item.quantitySold;
      profit += rev - cost;
      const name = item.Product ? item.Product.name : `#${item.productId}`;
      byProduct[name] = (byProduct[name] || 0) + item.quantitySold;
    }
  }
  const ranked = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);
  return { revenue: round2(revenue), profit: round2(profit), ranked };
}

// Turns the raw DB context into a compact text block Grok can reason over.
// Keeping this as plain text (not raw JSON dumps) keeps token usage down and
// gives the model something closer to how a shopkeeper would describe their
// own numbers.
function buildGrokContext(context) {
  const today = aggregate(context.todaySales);
  const month = aggregate(context.monthSales);
  const low = context.products.filter(p => (p.Inventory?.currentQuantity ?? 0) <= p.lowStockThreshold);
  const expiringSoon = context.products.filter(p => p.expiryDate && new Date(p.expiryDate) <= new Date(Date.now() + 15 * 86400000));

  const lines = [
    `Today: revenue ₹${today.revenue}, profit ₹${today.profit}, ${context.todaySales.length} transaction(s).`,
    `This month so far: revenue ₹${month.revenue}, profit ₹${month.profit}, ${context.monthSales.length} transaction(s).`,
    `Top-selling products this month (name: units sold): ${month.ranked.slice(0, 10).map(([n, u]) => `${n}: ${u}`).join(', ') || 'none yet'}.`,
    `Active catalog size: ${context.products.length} product(s).`,
    `Low-stock products (at/under their reorder threshold): ${low.map(p => `${p.name} (${p.Inventory.currentQuantity} left)`).join(', ') || 'none'}.`,
    `Products expiring within 15 days: ${expiringSoon.map(p => `${p.name} (${p.expiryDate})`).join(', ') || 'none'}.`,
    `Known customers, ranked by total amount spent (name: bills, total spent, last purchase): ${
      context.customers.map(c => `${c.name}: ${c.totalPurchases} bills, ₹${c.totalAmountSpent}, last ${c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toISOString().slice(0, 10) : 'never'}`).join(' | ') || 'no known customers yet'
    }.`,
  ];
  return lines.join('\n');
}

// Calls xAI's Grok API (OpenAI-compatible chat completions endpoint).
// Docs: https://docs.x.ai — set GROK_API_KEY in .env to enable this; the
// route falls back to answerLocally() automatically if the key is missing
// or the call fails for any reason, so the assistant never hard-fails.
async function askGrok(question, context) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROK_MODEL || 'grok-4.3';
  const dataBlock = buildGrokContext(context);

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: 'You are a business assistant for a small retail shop\'s billing app. Answer the owner\'s question using ONLY the shop data provided below — never invent numbers. Be concise (2-4 sentences), speak in ₹ (Indian rupees), and if the data doesn\'t cover the question, say so plainly instead of guessing.\n\nShop data:\n' + dataBlock,
        },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Grok API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('Grok API returned an empty response');
  return answer;
}
function answerLocally(question, context) {
  const q = question.toLowerCase();
  const today = aggregate(context.todaySales);
  const month = aggregate(context.monthSales);

  if (/today.*sale|sale.*today/.test(q)) {
    return `Today's sales: ₹${today.revenue} in revenue across ${context.todaySales.length} transaction(s), with an estimated profit of ₹${today.profit}.`;
  }
  if (/(this month|monthly).*(sale|revenue)|sale.*month/.test(q)) {
    return `This month so far: ₹${month.revenue} in revenue across ${context.monthSales.length} transaction(s), estimated profit ₹${month.profit}.`;
  }
  if (/profit/.test(q) && /today/.test(q)) {
    return `Estimated profit today is ₹${today.profit} (revenue ₹${today.revenue}).`;
  }
  if (/profit/.test(q)) {
    return `Estimated profit this month is ₹${month.profit} (revenue ₹${month.revenue}).`;
  }
  if (/(highest|best|top|most).*(sell|sale|selling)/.test(q) || /which product.*sell/.test(q)) {
    if (month.ranked.length === 0) return `No sales recorded yet this month.`;
    const [name, units] = month.ranked[0];
    return `"${name}" is your top seller this month with ${units} unit(s) sold.`;
  }
  if (/low stock|running (out|low)|reorder/.test(q)) {
    const low = context.products.filter(p => (p.Inventory?.currentQuantity ?? 0) <= p.lowStockThreshold);
    if (low.length === 0) return `No products are currently low on stock. You're in good shape.`;
    const list = low.slice(0, 5).map(p => `${p.name} (${p.Inventory.currentQuantity} left)`).join(', ');
    return `${low.length} product(s) are low on stock: ${list}${low.length > 5 ? ', and more' : ''}.`;
  }
  if (/expir/.test(q)) {
    const soon = context.products.filter(p => p.expiryDate && new Date(p.expiryDate) <= new Date(Date.now() + 15 * 86400000));
    if (soon.length === 0) return `No products are nearing expiry in the next 15 days.`;
    const list = soon.slice(0, 5).map(p => `${p.name} (expires ${p.expiryDate})`).join(', ');
    return `${soon.length} product(s) are nearing expiry: ${list}.`;
  }
  if (/how many product|catalog size|total product/.test(q)) {
    return `You currently have ${context.products.length} active product(s) in your catalog.`;
  }

  return `I can answer questions like "What were today's sales?", "Which product sold the most this month?", "What's my profit this month?", "What's running low on stock?", or "What's nearing expiry?". Try rephrasing your question along those lines.`;
}

// POST /api/ai/ask   Body: { question: string }
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    const context = await getContext(req.user.retailerId);

    let answer;
    let source = 'local';
    try {
      const grokAnswer = await askGrok(question, context);
      if (grokAnswer) { answer = grokAnswer; source = 'grok'; }
    } catch (grokErr) {
      // Grok is unreachable / key invalid / rate-limited etc. Don't fail the
      // request — fall back to the rule-based answer so the assistant stays
      // usable, just log it so it's visible during setup.
      console.error('Grok API call failed, falling back to local answers:', grokErr.message);
    }

    if (!answer) answer = answerLocally(question, context);

    res.json({ question, answer, source });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
