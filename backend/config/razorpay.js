// Razorpay configuration (Lab 06) - SERVER SIDE ONLY.
//
// RAZORPAY_KEY_SECRET is read here and used for exactly two things:
//   1. the Razorpay Node SDK when creating an order, and
//   2. HMAC-SHA256 signature verification in order.controller.js.
// It is NEVER sent to React - only the Key ID (which is public: it is meant to
// be visible in the checkout page) is returned to the browser.
//
// Use TEST mode keys (rzp_test_...) from the Razorpay dashboard. The secret is
// read from the environment, so nothing is hardcoded.

const Razorpay = require('razorpay');

let client = null;

function assertConfigured() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const err = new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env (Test Mode keys).'
    );
    err.status = 500;
    throw err;
  }
}

// Lazily built client: the SDK throws at construction time when key_id is
// missing, and an unconfigured .env must not stop the rest of the API (auth,
// products, wishlist, cart) from booting.
function getRazorpay() {
  assertConfigured();
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

// Public Key ID -> safe to hand to the frontend checkout.
function getKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

// Test seam: lets the automated suite swap the outbound HTTP client without
// changing any application code path. Never used at runtime.
function __setRazorpayInstanceForTests(testInstance) {
  client = testInstance;
}

module.exports = { getRazorpay, assertConfigured, getKeyId, __setRazorpayInstanceForTests };