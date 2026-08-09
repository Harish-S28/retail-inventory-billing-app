const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Retailer = require('./Retailer');

// One row per real-world customer, scoped to a retailer. Every retailer also
// gets exactly one "Unknown" customer (isUnknown = true) that walk-in sales
// with no name attach to, so aggregate reporting (known vs unknown) always
// has somewhere to point without special-casing null customerId everywhere.
//
// totalPurchases / totalAmountSpent / totalQuantityPurchased / first-last
// purchase dates are denormalized rollups, kept in sync inside the sales
// transaction (see routes/sales.js) so the Customers page and dashboard
// never need to re-aggregate the whole sales table on every request.
//
// discountPercent exists now (default 0, unused by billing yet) so a future
// loyalty-discount feature just needs to read this column at checkout time —
// no migration required later.
const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  retailerId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: true },
  isUnknown: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

  totalPurchases: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalAmountSpent: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  totalQuantityPurchased: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  firstPurchaseDate: { type: DataTypes.DATE, allowNull: true },
  lastPurchaseDate: { type: DataTypes.DATE, allowNull: true },

  // Reserved for the future loyalty-discount feature — always 0 today.
  discountPercent: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },

  // Reserved for the ML segmentation phase (RFM / K-Means). Left null until
  // that phase runs; the AI assistant and dashboard will read this column.
  segment: { type: DataTypes.STRING, allowNull: true },
  segmentUpdatedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'customers',
  timestamps: true,
  indexes: [
    { fields: ['retailerId', 'name'] },
    { fields: ['retailerId', 'isUnknown'] },
  ],
});

Customer.belongsTo(Retailer, { foreignKey: 'retailerId' });
Retailer.hasMany(Customer, { foreignKey: 'retailerId' });

module.exports = Customer;
