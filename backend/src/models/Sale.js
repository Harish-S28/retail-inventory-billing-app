const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Retailer = require('./Retailer');
const User = require('./User');
const Product = require('./Product');
const Customer = require('./Customer');

// Transaction header - one row per billing event (a customer's whole basket)
const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  retailerId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false }, // who processed it (accountability)
  customerId: { type: DataTypes.INTEGER, allowNull: false }, // every bill has a customer - real or the retailer's "Unknown" record
  totalAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  paymentMode: { type: DataTypes.STRING, defaultValue: 'cash' },
}, {
  tableName: 'sales',
  timestamps: true,
});

// Line items - immutable, append-only. This doubles as the "sales history"
// table: every product sold, in what quantity, at what price, by whom, when.
const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  saleId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantitySold: { type: DataTypes.INTEGER, allowNull: false },
  priceAtSale: { type: DataTypes.FLOAT, allowNull: false },
  costAtSale: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'sale_items',
  timestamps: true,
  updatedAt: false,
});

Sale.belongsTo(Retailer, { foreignKey: 'retailerId' });
Sale.belongsTo(User, { foreignKey: 'userId' });
Sale.belongsTo(Customer, { foreignKey: 'customerId' });
Customer.hasMany(Sale, { foreignKey: 'customerId' });
Sale.hasMany(SaleItem, { foreignKey: 'saleId', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId' });
SaleItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = { Sale, SaleItem };
