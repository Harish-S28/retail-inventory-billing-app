const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Retailer = sequelize.define('Retailer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  shopName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'retailers',
  timestamps: true,
});

module.exports = Retailer;
