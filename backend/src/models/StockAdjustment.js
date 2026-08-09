const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Product = require('./Product');
const User = require('./User');

// Admin-only manual stock corrections (damage, recount, etc.) - always
// logged with a reason and the user who made the change.
const StockAdjustment = sequelize.define('StockAdjustment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  quantityChange: { type: DataTypes.INTEGER, allowNull: false }, // +/-
  reason: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'stock_adjustments',
  timestamps: true,
  updatedAt: false,
});

StockAdjustment.belongsTo(Product, { foreignKey: 'productId' });
StockAdjustment.belongsTo(User, { foreignKey: 'userId' });

module.exports = StockAdjustment;
