// Customer segmentation via RFM analysis (Recency, Frequency, Monetary).
//
// Why RFM instead of K-Means: K-Means needs a meaningful volume of customers
// to produce stable, meaningful clusters — on a new shop with a handful of
// customers it would produce arbitrary, unstable groupings. RFM is
// rule-based and explainable ("this customer is At-Risk because it's been
// 60 days since their last visit"), and works correctly from day one, even
// with very few customers. It's also the industry-standard technique this
// exact problem (retail customer segmentation) is usually solved with.
//
// How it works:
//   1. Compute each known customer's Recency (days since last purchase),
//      Frequency (total bills), and Monetary (total amount spent).
//   2. Score each dimension 1-4 by quartile, relative to this retailer's
//      *own* customer base (so a "high spender" is judged against this
//      shop's actual customers, not a fixed rupee amount that wouldn't
//      make sense across shops of different sizes).
//   3. Map the R/F/M scores onto one of the business-facing segment labels
//      via a simple, documented rule table.

const SEGMENTS = {
  NEW: 'New Customer',
  LOYAL: 'Loyal Customer',
  HIGH_VALUE: 'High-Value Customer',
  FREQUENT: 'Frequent Buyer',
  OCCASIONAL: 'Occasional Buyer',
  AT_RISK: 'At-Risk Customer',
  LOST: 'Lost Customer',
};

function daysBetween(a, b) {
  return Math.floor((a - b) / 86400000);
}

// Splits a sorted-ascending numeric array into quartile cut points.
function quartiles(sortedValues) {
  const q = (p) => {
    if (sortedValues.length === 0) return 0;
    const idx = (sortedValues.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedValues[lo];
    return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
  };
  return { q1: q(0.25), q2: q(0.5), q3: q(0.75) };
}

// Higher raw value -> higher score (used for frequency, monetary).
function scoreAscending(value, { q1, q2, q3 }) {
  if (value <= q1) return 1;
  if (value <= q2) return 2;
  if (value <= q3) return 3;
  return 4;
}

// Lower raw value -> higher score (used for recency: fewer days = better).
function scoreDescending(value, { q1, q2, q3 }) {
  if (value <= q1) return 4;
  if (value <= q2) return 3;
  if (value <= q3) return 2;
  return 1;
}

/**
 * Computes an RFM segment for every customer in `customers`.
 * @param {Array} customers - Customer model instances (isUnknown: false only)
 * @param {Date} now - reference date (injectable for testing)
 * @returns {Map<number, {segment: string, recencyDays: number, scores: {r:number,f:number,m:number}}>}
 */
function computeSegments(customers, now = new Date()) {
  const results = new Map();
  if (customers.length === 0) return results;

  // Fewer than 4 customers isn't enough to form meaningful quartiles against
  // peers — fall back to simple absolute rules so small shops still get a
  // sensible label instead of noisy relative scoring on n=1..3.
  if (customers.length < 4) {
    for (const c of customers) {
      const recencyDays = c.lastPurchaseDate ? daysBetween(now, new Date(c.lastPurchaseDate)) : Infinity;
      results.set(c.id, {
        segment: classifySmallSample(c, recencyDays),
        recencyDays: Number.isFinite(recencyDays) ? recencyDays : null,
        scores: null,
      });
    }
    return results;
  }

  const withRecency = customers.map((c) => ({
    customer: c,
    recencyDays: c.lastPurchaseDate ? daysBetween(now, new Date(c.lastPurchaseDate)) : 9999,
    frequency: c.totalPurchases,
    monetary: c.totalAmountSpent,
  }));

  const recencyQ = quartiles([...withRecency.map((x) => x.recencyDays)].sort((a, b) => a - b));
  const frequencyQ = quartiles([...withRecency.map((x) => x.frequency)].sort((a, b) => a - b));
  const monetaryQ = quartiles([...withRecency.map((x) => x.monetary)].sort((a, b) => a - b));

  for (const x of withRecency) {
    const r = scoreDescending(x.recencyDays, recencyQ);
    const f = scoreAscending(x.frequency, frequencyQ);
    const m = scoreAscending(x.monetary, monetaryQ);

    results.set(x.customer.id, {
      segment: classify(x.customer, { r, f, m }, x.recencyDays),
      recencyDays: x.recencyDays,
      scores: { r, f, m },
    });
  }

  return results;
}

// Rule table mapping R/F/M scores (1-4 each) onto one business label.
// Order matters - first matching rule wins.
function classify(customer, { r, f, m }, recencyDays) {
  if (customer.totalPurchases <= 1 && recencyDays <= 30) return SEGMENTS.NEW;
  if (r === 1 && recencyDays > 90) return SEGMENTS.LOST;
  if (r <= 2 && f >= 3) return SEGMENTS.AT_RISK; // used to buy often, gone quiet
  if (m === 4 && r >= 3) return SEGMENTS.HIGH_VALUE; // top spender, still active
  if (f >= 3 && r >= 3) return SEGMENTS.LOYAL; // buys often and recently
  if (f >= 3) return SEGMENTS.FREQUENT;
  return SEGMENTS.OCCASIONAL;
}

// Absolute-threshold fallback for shops with under 4 known customers.
function classifySmallSample(customer, recencyDays) {
  if (customer.totalPurchases <= 1 && recencyDays <= 30) return SEGMENTS.NEW;
  if (recencyDays > 90) return SEGMENTS.LOST;
  if (recencyDays > 45) return SEGMENTS.AT_RISK;
  if (customer.totalPurchases >= 5) return SEGMENTS.LOYAL;
  if (customer.totalPurchases >= 3) return SEGMENTS.FREQUENT;
  return SEGMENTS.OCCASIONAL;
}

module.exports = { computeSegments, SEGMENTS };
