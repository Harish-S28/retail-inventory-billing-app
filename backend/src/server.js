require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const scheduleAlertJob = require('./utils/alertJob');
const scheduleSegmentJob = require('./utils/segmentJob');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const alertsRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const customersRoutes = require('./routes/customers');

const app = express();

// In dev, FRONTEND_URL is unset so all origins are allowed (Vite proxy avoids
// CORS anyway). In production, set FRONTEND_URL to your deployed Vercel URL
// so only your own frontend can call this API.
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/customers', customersRoutes);

const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await sequelize.sync(); // creates tables if they don't exist
  scheduleAlertJob();
  scheduleSegmentJob();
  app.listen(PORT, () => console.log(`Retail backend running on http://localhost:${PORT}`));
}

start();
