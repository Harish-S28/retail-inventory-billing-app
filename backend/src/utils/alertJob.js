const cron = require('node-cron');
const { Product, Inventory } = require('../models');

// Runs once a day (06:00 server time) and logs a summary per retailer.
// In production this is where you'd fan out to the Email/SMS service
// (see routes/alerts.js for the same logic exposed as a live API for the
// in-app pop-up notification, which checks on every dashboard load).
function scheduleAlertJob() {
  cron.schedule('0 6 * * *', async () => {
    const products = await Product.findAll({ where: { isActive: true }, include: [{ model: Inventory }] });
    const today = new Date();
    let lowStockCount = 0, expiringCount = 0;

    for (const p of products) {
      const qty = p.Inventory ? p.Inventory.currentQuantity : 0;
      if (qty <= p.lowStockThreshold) lowStockCount++;
      if (p.expiryDate) {
        const days = Math.ceil((new Date(p.expiryDate) - today) / 86400000);
        if (days <= 15) expiringCount++;
      }
    }
    console.log(`[alert-job] ${lowStockCount} low-stock, ${expiringCount} expiring-soon products found.`);
  });
}

module.exports = scheduleAlertJob;
