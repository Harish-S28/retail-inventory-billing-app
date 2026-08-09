const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Customer } = require('../models');

// Every retailer has exactly one shared "Unknown" customer that walk-in
// sales with no name attach to. Created lazily on first use so retailers
// who never bother with customer names never see an empty row for nothing.
async function getOrCreateUnknownCustomer(retailerId, transaction) {
  const [customer] = await Customer.findOrCreate({
    where: { retailerId, isUnknown: true },
    defaults: { retailerId, name: 'Unknown', isUnknown: true },
    transaction,
  });
  return customer;
}

// Resolves what customer a bill should attach to, from whatever the billing
// screen sent:
//   - isUnknown: true                -> the retailer's shared Unknown record
//   - customerId                     -> must already exist for this retailer
//   - customerName                   -> case-insensitive match on an existing
//                                        customer, or a brand-new record if
//                                        no match (this is the "typing a new
//                                        name auto-creates a customer" rule)
//   - nothing provided                -> falls back to Unknown, so older
//                                        clients / API callers that don't
//                                        send customer info don't break
async function resolveCustomer(retailerId, { customerId, customerName, isUnknown }, transaction) {
  if (isUnknown) {
    return getOrCreateUnknownCustomer(retailerId, transaction);
  }

  if (customerId) {
    const customer = await Customer.findOne({ where: { id: customerId, retailerId }, transaction });
    if (!customer) throw new Error('Selected customer was not found');
    return customer;
  }

  const trimmedName = (customerName || '').trim();
  if (trimmedName) {
    if (trimmedName.toLowerCase() === 'unknown') {
      return getOrCreateUnknownCustomer(retailerId, transaction);
    }

    // Case-insensitive match ("john", "John", "JOHN" -> same customer) so
    // typos in casing don't fragment one customer into several records.
    // Works on both SQLite and Postgres via LOWER(), unlike Op.iLike which
    // is Postgres-only.
    const existing = await Customer.findOne({
      where: {
        retailerId,
        isUnknown: false,
        [Op.and]: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName.toLowerCase()),
      },
      transaction,
    });
    if (existing) return existing;

    return Customer.create({ retailerId, name: trimmedName }, { transaction });
  }

  return getOrCreateUnknownCustomer(retailerId, transaction);
}

// Applies one completed sale's effect onto its customer's rolling stats.
// Called inside the same DB transaction as the sale itself so the two never
// drift out of sync.
async function recordPurchaseOnCustomer(customer, { totalAmount, totalQuantity }, transaction) {
  const now = new Date();
  await customer.update({
    totalPurchases: customer.totalPurchases + 1,
    totalAmountSpent: customer.totalAmountSpent + totalAmount,
    totalQuantityPurchased: customer.totalQuantityPurchased + totalQuantity,
    firstPurchaseDate: customer.firstPurchaseDate || now,
    lastPurchaseDate: now,
  }, { transaction });
}

module.exports = { getOrCreateUnknownCustomer, resolveCustomer, recordPurchaseOnCustomer };
