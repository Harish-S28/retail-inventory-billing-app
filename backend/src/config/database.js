const { Sequelize } = require('sequelize');
const path = require('path');

// Local dev: uses SQLite, zero config, no external database needed.
// Production (e.g. Render/Railway backend + Neon/Supabase Postgres):
// set DATABASE_URL in the environment and this automatically switches
// to Postgres. No model or route code needs to change either way.
let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // required by most hosted Postgres providers (Neon, Supabase, Render)
      },
    },
  });
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', '..', 'data', 'retail.sqlite'),
    logging: false,
  });
}

module.exports = sequelize;
