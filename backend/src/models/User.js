const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Retailer = require('./Retailer');

// Represents a login account under a retailer's shop.
// role = 'admin' -> the retailer/owner themself (full access)
// role = 'staff' -> hired labour, restricted to billing/sales entry
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  retailerId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'staff'), allowNull: false, defaultValue: 'staff' },
}, {
  tableName: 'users',
  timestamps: true,
});

User.belongsTo(Retailer, { foreignKey: 'retailerId' });
Retailer.hasMany(User, { foreignKey: 'retailerId' });

module.exports = User;
