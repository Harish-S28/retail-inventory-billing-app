const cron = require('node-cron');
const { Retailer, Customer } = require('../models');
const { computeSegments } = require('./segmentation');

// Runs once a day (06:30 server time, just after the stock alert job) and
// recomputes RFM segments for every retailer's known customers. Keeps the
// `segment` column fresh without the Customers page or AI assistant having
// to pay the cost of recomputing on every request — see routes/customers.js
// POST /segment for the same logic exposed as an on-demand endpoint.
function scheduleSegmentJob() {
  cron.schedule('30 6 * * *', async () => {
    const retailers = await Retailer.findAll({ attributes: ['id'] });
    let totalUpdated = 0;

    for (const retailer of retailers) {
      const customers = await Customer.findAll({ where: { retailerId: retailer.id, isUnknown: false } });
      if (customers.length === 0) continue;

      const results = computeSegments(customers);
      const now = new Date();
      for (const customer of customers) {
        const result = results.get(customer.id);
        if (!result) continue;
        await customer.update({ segment: result.segment, segmentUpdatedAt: now });
        totalUpdated++;
      }
    }
    console.log(`[segment-job] Recomputed segments for ${totalUpdated} customer(s) across ${retailers.length} retailer(s).`);
  });
}

module.exports = scheduleSegmentJob;
