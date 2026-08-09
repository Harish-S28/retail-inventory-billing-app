const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Retailer = require('./Retailer');

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  retailerId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING },
  rackLocation: { type: DataTypes.STRING },
  costPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  sellingPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  lowStockThreshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'products',
  timestamps: true,
});

Product.belongsTo(Retailer, { foreignKey: 'retailerId' });
Retailer.hasMany(Product, { foreignKey: 'retailerId' });

module.exports = Product;
