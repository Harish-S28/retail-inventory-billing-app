const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');

// Kept separate from Product so stock levels can update at high frequency
// (every sale) without touching master product data, and so multi-location
// stock could be added later without restructuring the catalog table.
const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  currentQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'inventory',
  timestamps: true,
  updatedAt: 'lastUpdated',
});

Inventory.belongsTo(Product, { foreignKey: 'productId' });
Product.hasOne(Inventory, { foreignKey: 'productId' });

module.exports = Inventory;
