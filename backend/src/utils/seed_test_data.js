const bcrypt = require('bcryptjs');
const { sequelize, Retailer, User, Product, Inventory, Customer, Sale, SaleItem } = require('../models');
const { computeSegments } = require('./segmentation');

async function seedData() {
  await sequelize.sync();

  const email = 'janakiharish28@gmail.com';
  const password = '123456';

  console.log(`Checking if retailer/user with email "${email}" exists...`);
  let user = await User.findOne({ where: { email } });
  let retailer;

  if (!user) {
    console.log('User not found. Creating Retailer & Admin User...');
    const passwordHash = await bcrypt.hash(password, 10);
    retailer = await Retailer.create({
      shopName: "Harish Supermarket",
      email: email,
      phone: "9876543210",
      passwordHash: passwordHash
    });

    user = await User.create({
      retailerId: retailer.id,
      name: "Harish-S28 (Owner)",
      email: email,
      passwordHash: passwordHash,
      role: 'admin'
    });
  } else {
    retailer = await Retailer.findByPk(user.retailerId);
    console.log(`Found existing user "${user.name}" under shop "${retailer.shopName}".`);
  }

  const retailerId = retailer.id;
  const userId = user.id;

  console.log('Cleaning up any existing testing products, customers, and sales...');
  // Delete existing sales, products, and customers to avoid duplicates/conflicts on re-run.
  await SaleItem.destroy({ where: {} });
  await Sale.destroy({ where: { retailerId } });
  await Inventory.destroy({ where: {} });
  await Product.destroy({ where: { retailerId } });
  await Customer.destroy({ where: { retailerId } });

  console.log('Creating "Unknown" customer...');
  const unknownCustomer = await Customer.create({
    retailerId,
    name: 'Unknown',
    isUnknown: true
  });

  console.log('Creating test customers...');
  const now = new Date();

  // Helper to compute a date offset by N days
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Define some known test customers with specific purchase history profiles
  const john = await Customer.create({
    retailerId,
    name: 'John Doe',
    phone: '9888877777',
    isUnknown: false
  });

  const alice = await Customer.create({
    retailerId,
    name: 'Alice Smith',
    phone: '9777766666',
    isUnknown: false
  });

  const bob = await Customer.create({
    retailerId,
    name: 'Bob Johnson',
    phone: '9666655555',
    isUnknown: false
  });

  const emma = await Customer.create({
    retailerId,
    name: 'Emma Davis',
    phone: '9555544444',
    isUnknown: false
  });

  console.log('Creating products with inventory levels...');
  const productsData = [
    { name: 'Fresh Milk 1L', category: 'Dairy', rackLocation: 'A1', costPrice: 35, sellingPrice: 45, lowStockThreshold: 10, qty: 50 },
    { name: 'Whole Wheat Bread', category: 'Bakery', rackLocation: 'B2', costPrice: 22, sellingPrice: 32, lowStockThreshold: 8, qty: 30 },
    { name: 'Premium Basmati Rice 5kg', category: 'Grains', rackLocation: 'C1', costPrice: 350, sellingPrice: 420, lowStockThreshold: 5, qty: 15 },
    { name: 'Farm Eggs 12pk', category: 'Dairy', rackLocation: 'A2', costPrice: 50, sellingPrice: 70, lowStockThreshold: 15, qty: 60 },
    { name: 'Red Apples 1kg', category: 'Fruits', rackLocation: 'D1', costPrice: 100, sellingPrice: 140, lowStockThreshold: 10, qty: 4 }, // Low stock!
    { name: 'Expiring Apple Juice', category: 'Beverages', rackLocation: 'E1', costPrice: 40, sellingPrice: 60, lowStockThreshold: 5, qty: 25, expiryDate: daysAgo(-5).toISOString().slice(0,10) }, // Expiring soon!
    { name: 'Diet Soda 330ml', category: 'Beverages', rackLocation: 'E2', costPrice: 20, sellingPrice: 30, lowStockThreshold: 12, qty: 45 },
    { name: 'Potato Chips Family Pack', category: 'Snacks', rackLocation: 'F3', costPrice: 25, sellingPrice: 35, lowStockThreshold: 15, qty: 80 }
  ];

  const products = [];
  for (const item of productsData) {
    const prod = await Product.create({
      retailerId,
      name: item.name,
      category: item.category,
      rackLocation: item.rackLocation,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      lowStockThreshold: item.lowStockThreshold,
      expiryDate: item.expiryDate || null,
      isActive: true
    });

    await Inventory.create({
      productId: prod.id,
      currentQuantity: item.qty
    });

    products.push({ ...prod.get({ plain: true }), qty: item.qty });
  }

  // Find products helper
  const getProdByName = (name) => products.find(p => p.name === name);

  console.log('Creating historical sales and updating customer stats...');

  const salesData = [
    // John Doe - Loyal Customer profile (buys frequently and recently)
    {
      customer: john,
      date: daysAgo(30),
      items: [
        { prod: getProdByName('Fresh Milk 1L'), qty: 2 },
        { prod: getProdByName('Whole Wheat Bread'), qty: 1 }
      ]
    },
    {
      customer: john,
      date: daysAgo(15),
      items: [
        { prod: getProdByName('Fresh Milk 1L'), qty: 3 },
        { prod: getProdByName('Farm Eggs 12pk'), qty: 1 },
        { prod: getProdByName('Diet Soda 330ml'), qty: 4 }
      ]
    },
    {
      customer: john,
      date: daysAgo(1),
      items: [
        { prod: getProdByName('Premium Basmati Rice 5kg'), qty: 1 },
        { prod: getProdByName('Fresh Milk 1L'), qty: 2 },
        { prod: getProdByName('Potato Chips Family Pack'), qty: 2 }
      ]
    },

    // Alice Smith - At-Risk Customer profile (spent a lot, but hasn't bought in over 2 months)
    {
      customer: alice,
      date: daysAgo(75),
      items: [
        { prod: getProdByName('Premium Basmati Rice 5kg'), qty: 3 },
        { prod: getProdByName('Fresh Milk 1L'), qty: 5 }
      ]
    },
    {
      customer: alice,
      date: daysAgo(62),
      items: [
        { prod: getProdByName('Premium Basmati Rice 5kg'), qty: 4 },
        { prod: getProdByName('Red Apples 1kg'), qty: 2 }
      ]
    },

    // Emma Davis - Lost Customer profile (bought once 100 days ago)
    {
      customer: emma,
      date: daysAgo(100),
      items: [
        { prod: getProdByName('Fresh Milk 1L'), qty: 1 },
        { prod: getProdByName('Whole Wheat Bread'), qty: 1 }
      ]
    },

    // Bob Johnson - New Customer profile (purchased today)
    {
      customer: bob,
      date: daysAgo(0),
      items: [
        { prod: getProdByName('Farm Eggs 12pk'), qty: 1 },
        { prod: getProdByName('Diet Soda 330ml'), qty: 6 }
      ]
    },

    // Unknown walk-in customers
    {
      customer: unknownCustomer,
      date: daysAgo(20),
      items: [
        { prod: getProdByName('Whole Wheat Bread'), qty: 2 },
        { prod: getProdByName('Fresh Milk 1L'), qty: 1 }
      ]
    },
    {
      customer: unknownCustomer,
      date: daysAgo(5),
      items: [
        { prod: getProdByName('Potato Chips Family Pack'), qty: 4 },
        { prod: getProdByName('Diet Soda 330ml'), qty: 2 }
      ]
    },
    {
      customer: unknownCustomer,
      date: daysAgo(0),
      items: [
        { prod: getProdByName('Fresh Milk 1L'), qty: 1 },
        { prod: getProdByName('Expiring Apple Juice'), qty: 1 }
      ]
    }
  ];

  for (const s of salesData) {
    let totalAmount = 0;
    let totalQuantity = 0;

    const sale = await Sale.create({
      retailerId,
      userId,
      customerId: s.customer.id,
      paymentMode: 'cash',
      createdAt: s.date,
      updatedAt: s.date
    });

    for (const itemLine of s.items) {
      const lineTotal = itemLine.prod.sellingPrice * itemLine.qty;
      totalAmount += lineTotal;
      totalQuantity += itemLine.qty;

      await SaleItem.create({
        saleId: sale.id,
        productId: itemLine.prod.id,
        quantitySold: itemLine.qty,
        priceAtSale: itemLine.prod.sellingPrice,
        costAtSale: itemLine.prod.costPrice,
        createdAt: s.date
      });
    }

    await sale.update({ totalAmount });

    // Update customer stats
    const cust = s.customer;
    await cust.update({
      totalPurchases: cust.totalPurchases + 1,
      totalAmountSpent: cust.totalAmountSpent + totalAmount,
      totalQuantityPurchased: cust.totalQuantityPurchased + totalQuantity,
      firstPurchaseDate: cust.firstPurchaseDate || s.date,
      lastPurchaseDate: s.date
    });
  }

  console.log('Running segmentation for newly added customers...');
  const customers = await Customer.findAll({ where: { retailerId, isUnknown: false } });
  const segmentationResults = computeSegments(customers, now);

  for (const customer of customers) {
    const res = segmentationResults.get(customer.id);
    if (res) {
      await customer.update({
        segment: res.segment,
        segmentUpdatedAt: now
      });
      console.log(`Customer: ${customer.name} -> ${res.segment}`);
    }
  }

  console.log('\nSuccess! Successfully populated test data.');
}

seedData().catch(console.error);
