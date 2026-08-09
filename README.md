# Ledger — Retail Inventory & Billing Management

A full-stack web app for small/local retailers: product & inventory management,
billing that auto-deducts stock, staff accountability, low-stock/expiry alerts,
an AI business assistant, and sales dashboards.

This matches the requirements document discussed earlier. See that document for
the full functional spec — this README covers how to actually run the app.

---

## 1. What's inside

```
retail-app/
  backend/     Node.js + Express API, Sequelize ORM, SQLite (swappable to PostgreSQL/MySQL)
  frontend/    React + Vite + Tailwind CSS
```

**Stack actually used in this build** (a practical subset of the full recommended
stack from the requirements doc):
- Frontend: React, Vite, Tailwind CSS, React Router, Recharts, Axios
- Backend: Node.js + Express, Sequelize ORM, JWT auth
- Database: SQLite for zero-config local use — the Sequelize models work
  unchanged against PostgreSQL/MySQL, see section 5.
- AI Assistant: built-in rule-based engine that reads your real data (no
  API key needed to try it). Swappable for OpenAI/Gemini, see section 6.

Not yet wired (straightforward to add later, hooks are in place — see section 7):
Stripe/Razorpay payment capture, Elasticsearch, Redis, Email/SMS delivery,
Google OAuth login.

---

## 2. Prerequisites

- Node.js 18 or later (check with `node -v`)
- npm (comes with Node)

---

## 3. Run the backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The API runs at `http://localhost:4000`. It auto-creates a local SQLite
database file at `backend/data/retail.sqlite` on first run — no separate
database server needed.

Health check: `curl http://localhost:4000/api/health`

---

## 4. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` requests to the
backend on port 4000 (see `frontend/vite.config.js`), so no CORS setup is
needed locally.

**First use:** click "Register here" and create your shop account. That
account is your Admin/Owner login. From the **Staff** page (admin only) you
can then create restricted logins for hired employees — every sale they bill
is tracked against their name for accountability.

---

## 5. Moving from SQLite to PostgreSQL/MySQL

Only one file needs to change: `backend/src/config/database.js`. Swap the
`dialect` and connection details, e.g. for PostgreSQL:

```js
const sequelize = new Sequelize('retail_db', 'your_user', 'your_password', {
  host: 'localhost',
  dialect: 'postgres',
});
```

Install the driver (`npm install pg pg-hstore`), and no model or route code
needs to change — Sequelize abstracts the SQL dialect.

---

## 6. Wiring a real AI model (OpenAI/Gemini)

`backend/src/routes/ai.js` currently answers questions with a local
rule-based engine (`answerLocally`) so the assistant works out of the box.
To use a real LLM instead:

1. Add your key to `backend/.env` (`OPENAI_API_KEY` or `GEMINI_API_KEY`
   placeholders are already there).
2. In `routes/ai.js`, replace the `answerLocally(question, context)` call
   with a call to the LLM API, passing the same `context` object (today's
   sales, this month's sales, and the product list) as grounding data in
   the prompt, and returning the model's text response.

This keeps the assistant scoped strictly to the logged-in retailer's own
data, since `context` is built from a query filtered by `retailerId`.

---

## 7. Where to plug in the remaining integrations

| Integration | Where to add it |
|---|---|
| Stripe / Razorpay | `backend/src/routes/sales.js` — the `POST /api/sales` handler already accepts `paymentMode`; add a charge call before creating the `Sale` record. |
| Email/SMS alerts | `backend/src/utils/alertJob.js` — the daily cron job already computes low-stock/expiring counts; add your SendGrid/Twilio call where it currently just logs to console. |
| Google OAuth login | `backend/src/routes/auth.js` — add a `/api/auth/google` route using `passport-google-oauth20` or similar, issuing the same JWT shape as `/login`. |
| Elasticsearch | `backend/src/routes/products.js` — the `GET /api/products?search=` handler currently does a SQL `LIKE` search; swap for an ES query for typo-tolerant search at scale. |
| Redis | Add as a cache layer in front of `GET /api/products` and `GET /api/dashboard/summary` for high-traffic shops. |

---

## 8. Database structure (matches the requirements doc)

- **products** — master catalog (name, category, rack location, prices, expiry, low-stock threshold)
- **inventory** — live stock count per product, updated on every sale
- **sales** — one row per billing transaction (who processed it, total, payment mode)
- **sale_items** — immutable line items per sale (this is the permanent sales history / audit trail)
- **stock_adjustments** — logged manual stock corrections (admin only, with a reason)
- **retailers** / **users** — shop accounts and staff logins (role: admin or staff)

---

## 9. Deploying to production (Vercel + Render + Neon)

Vercel is great for the React frontend, but it can't run this Express backend
as-is (serverless functions are stateless, so the SQLite file and the
`node-cron` alert job wouldn't work there). The setup below keeps things free
and requires no backend rewrite:

| Piece | Host |
|---|---|
| Frontend | Vercel |
| Backend | Render (free tier) |
| Database | Neon or Supabase (free Postgres) |

### Step 1 — Create a Postgres database
1. Sign up at [neon.tech](https://neon.tech) (or supabase.com) and create a project.
2. Copy the connection string it gives you (looks like `postgres://user:pass@host/dbname`).

### Step 2 — Deploy the backend to Render
1. Push this project to GitHub (you've already done this).
2. On [render.com](https://render.com), create a **New Web Service**, connect your repo, set:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables (Render dashboard → Environment):
   - `DATABASE_URL` — the Neon/Supabase connection string from Step 1
   - `JWT_SECRET` — any long random string
   - `FRONTEND_URL` — your Vercel URL (add this after Step 3, then redeploy)
4. Deploy. Render gives you a URL like `https://your-app.onrender.com`.

### Step 3 — Deploy the frontend to Vercel
1. On [vercel.com](https://vercel.com), import the same GitHub repo.
2. Set root directory to `frontend`. Vercel auto-detects Vite.
3. Add environment variable: `VITE_API_URL` = `https://your-app.onrender.com/api`
4. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.
5. Go back to Render and set `FRONTEND_URL` to that Vercel URL, then redeploy the backend so CORS allows it.

### Step 4 — Verify
Visit your Vercel URL, register a shop, and confirm billing/products/dashboard all work against the live backend.

**Note:** Render's free tier spins down after inactivity, so the first request after idle time can take ~30 seconds to wake up — that's normal, not a bug.



## 10. Reporting issues / requesting changes

This is a working first version — let me know what to adjust (styling, a
missing field, a different flow, additional integrations) and I'll iterate.
