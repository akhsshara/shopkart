// Order controllers (Lab 06).
//
// THREATS THIS FILE IS BUILT AGAINST
//   1. Client sends its own prices/items/totalAmount  -> IGNORED entirely.
//      The request body may only contain `shippingAddress`; pricing always
//      comes from the customer's server-side cart + the LATEST Product docs.
//   2. Client claims paymentSuccess:true              -> IGNORED. The only proof
//      of payment is a valid Razorpay HMAC-SHA256 signature computed with the
//      server-side RAZORPAY_KEY_SECRET.
//   3. Client swaps in somebody else's razorpay_order_id -> rejected, because
//      the stored order.razorpayOrderId is the only accepted source of truth.
//   4. Guessing another user's order id                -> ownership is part of
//      the query (`{ _id, user: req.user._id }`), so the order is simply not
//      found - the response never confirms that someone else's order exists.

const crypto = require('crypto');
const mongoose = require('mongoose');

const Customer = require('../models/customer.model');
const Order = require('../models/order.model');
const { getRazorpay, assertConfigured, getKeyId } = require('../config/razorpay');
const { loadCartWithProducts } = require('./cart.controller');

const PHONE_RE = /^[0-9]{10}$/;
const PINCODE_RE = /^[0-9]{6}$/;
const SHIPPING_FIELDS = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];

// Dev-only fulfilment progression, blocked in production (see updateOrderStatus).
const STATUS_FLOW = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Normalise a phone number to its bare 10-digit national form.
// Spaces and dashes are always dropped. A country code is stripped ONLY when
// doing so leaves exactly 10 digits - an unconditional `replace(/^91/, '')`
// would mangle legitimate numbers that merely START with 91 (e.g. 9123456780).
function normalizePhone(raw) {
  let digits = String(raw).replace(/[\s-]/g, '');
  if (digits.startsWith('+91') && digits.length === 13) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
}

// Server-side validation of the shipping block. Runs BEFORE any DB write or
// Razorpay call, so a bad address never creates a half-finished order.
function validateShippingAddress(shippingAddress) {
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return { ok: false, message: 'Shipping address is required' };
  }

  const cleaned = {};
  for (const field of SHIPPING_FIELDS) {
    const value = shippingAddress[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return { ok: false, message: `${field} is required` };
    }
    cleaned[field] = value.trim();
  }

  const phoneDigits = normalizePhone(cleaned.phone);
  if (!PHONE_RE.test(phoneDigits)) {
    return { ok: false, message: 'Phone must be a valid 10-digit number' };
  }
  cleaned.phone = phoneDigits;

  if (!PINCODE_RE.test(cleaned.pincode)) {
    return { ok: false, message: 'Pincode must contain 6 digits' };
  }

  return { ok: true, value: cleaned };
}

// ------------------------------------------------ POST /orders/create-payment-order

//   1. authenticate              (middleware - req.user is the owner)
//   2. reload cart from MongoDB  (client cart state is never trusted)
//   3. reload Product documents  (prices/stock may have moved since add-to-cart)
//   4. re-verify stock
//   5. compute the total on the server (any totalAmount in the body is ignored)
//   6. snapshot items into an Order (PENDING_PAYMENT)
//   7. create the Razorpay order (amount in paise)
// The cart is NOT cleared here - only after the payment signature verifies.
async function createPaymentOrder(req, res, next) {
  // Only `shippingAddress` is read from the body. Everything else a client
  // sends (totalAmount, items, user) is ignored by design.
  const validation = validateShippingAddress(req.body && req.body.shippingAddress);
  if (!validation.ok) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  try {
    const loaded = await loadCartWithProducts(req.user._id);
    if (!loaded) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { cart, dropped } = loaded;

    if (dropped > 0) {
      return res.status(400).json({
        success: false,
        message: 'One or more products in your cart no longer exist. Please review your cart.',
      });
    }
    if (cart.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    // Final stock check against live data.
    for (const item of cart) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}. Only ${item.product.stock} left.`,
        });
      }
    }

    // Server owns pricing: total = sum(latest price x quantity).
    const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    const items = cart.map((item) => ({
      product: item.product._id,
      name: item.product.name, // purchase-time snapshot
      price: item.product.price, // purchase-time snapshot
      quantity: item.quantity,
      image: item.product.image,
    }));

    // Reuse an existing pending order so a retry after a failed/abandoned
    // payment does not litter the orders history with duplicate rows.
    let order = await Order.findOne({
      user: req.user._id,
      paymentStatus: 'PENDING',
      status: 'PENDING_PAYMENT',
    });

    if (order) {
      order.items = items;
      order.shippingAddress = validation.value;
      order.totalAmount = totalAmount;
      order.failureReason = undefined;
    } else {
      // Not saved yet - see the Razorpay call below.
      order = new Order({
        user: req.user._id,
        items,
        shippingAddress: validation.value,
        totalAmount,
        paymentStatus: 'PENDING',
        status: 'PENDING_PAYMENT',
      });
    }

    assertConfigured();

    // Razorpay works in the smallest currency unit: Rs.1 -> 100 paise.
    // This runs BEFORE the save so a Razorpay outage leaves no half-written
    // order behind. Mongoose assigns _id at construction time, so an unsaved
    // order can still be used as the receipt reference.
    const razorpayOrder = await getRazorpay().orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: order._id.toString(),
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // The Key ID is public (Checkout.js needs it). The Key SECRET is never
    // returned by any endpoint.
    res.status(200).json({
      success: true,
      message: 'Payment order created',
      shopKartOrderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      totalAmount,
      key: getKeyId(),
    });
  } catch (err) {
    if (err.statusCode || err.status) {
      return res.status(err.statusCode || err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

// ---------------------------------------------------- POST /orders/verify-payment

// The browser's success callback proves nothing - anyone can POST
// { razorpay_payment_id: "fake" }. The HMAC signature is the proof, because
// only Razorpay (holding the secret) can produce it.
async function verifyPayment(req, res, next) {
  try {
    const { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body || {};

    if (!shopKartOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing payment verification details' });
    }
    if (!isValidObjectId(shopKartOrderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    // Ownership is part of the query, so another user's order id is simply not
    // found - we never leak whether it exists.
    const order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Idempotent: a retried verification must not re-clear the cart.
    if (order.paymentStatus === 'PAID') {
      return res.status(200).json({ success: true, message: 'Payment already verified', order });
    }

    if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment does not match this order' });
    }

    // Sign the order id STORED IN OUR DB, never the one in the request body.
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${order.razorpayOrderId}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(String(razorpay_signature), 'utf8');

    const isValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      order.paymentStatus = 'FAILED';
      order.failureReason = 'Invalid payment signature';
      await order.save();
      // Cart intentionally untouched - a failed payment must not lose the cart.
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    order.paymentStatus = 'PAID';
    order.status = 'PLACED';
    order.razorpayPaymentId = razorpay_payment_id;
    order.failureReason = undefined;
    await order.save();

    // Only now - after a verified signature - is it safe to empty the cart.
    await Customer.findByIdAndUpdate(order.user, { cart: [] });

    res.status(200).json({
      success: true,
      message: 'Payment verified. Order placed successfully.',
      order,
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------------ GET /orders

// Only the current customer's orders, newest first.
async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}

// GET /orders/:id - the owner only. Guessing an id is not enough.
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await Order.findOne({ _id: id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------- PATCH /orders/:id/status
// BONUS - dev-only fulfilment progression. Blocked in production so it can never
// be used to skip fulfilment in a real deployment.
async function updateOrderStatus(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not available in production' });
    }

    const { id } = req.params;
    const { status } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }
    if (!STATUS_FLOW.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${STATUS_FLOW.join(', ')}`,
      });
    }

    const order = await Order.findOne({ _id: id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.paymentStatus !== 'PAID') {
      return res.status(400).json({ success: false, message: 'Cannot update an unpaid order' });
    }

    order.status = status;
    await order.save();

    res.status(200).json({ success: true, message: 'Order status updated', order });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPaymentOrder, verifyPayment, getMyOrders, getOrderById, updateOrderStatus };