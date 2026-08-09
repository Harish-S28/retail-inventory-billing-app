const sequelize = require('../config/database');
const Retailer = require('./Retailer');
const User = require('./User');
const Product = require('./Product');
const Inventory = require('./Inventory');
const Customer = require('./Customer');
const { Sale, SaleItem } = require('./Sale');
const StockAdjustment = require('./StockAdjustment');

module.exports = {
  sequelize,
  Retailer,
  User,
  Product,
  Inventory,
  Customer,
  Sale,
  SaleItem,
  StockAdjustment,
};
