// Cart controllers (Lab 05).
//
// The cart lives INSIDE the Customer document as [{ product: ObjectId,
// quantity }] - never full Product copies. Price and stock are NOT copied into
// the cart: they resolve live through populate(), so the UI always shows the
// current catalogue price and the checkout can re-check stock.
//
// Ownership always comes from the JWT (req.user). Subtotal and total units are
// deliberately NOT stored - they are derived on the client and recomputed on
// the server at checkout, because a persisted subtotal goes stale the moment a
// price changes.

const mongoose = require('mongoose');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Load the authenticated customer's full document and hydrate cart.product.
async function loadCustomerCart(userId) {
  const customer = await Customer.findById(userId);
  if (!customer) return null;
  await customer.populate({
    path: 'cart.product',
    select: 'name price image category stock',
  });
  return customer;
}

// Drop rows whose product no longer exists so the client never receives
// `{ product: null, quantity: 2 }`.
function aliveLines(customer) {
  return customer.cart.filter((item) => item.product);
}

// POST /cart/:productId  (protected)
// New product -> quantity 1. Existing product -> quantity + 1, capped by the
// latest stock.
async function addToCart(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).select('_id name stock');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < 1) {
      return res.status(400).json({ success: false, message: 'Product is out of stock' });
    }

    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const line = customer.cart.find((item) => item.product.equals(productId));

    if (line) {
      const nextQuantity = line.quantity + 1;
      if (nextQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available`,
        });
      }
      line.quantity = nextQuantity;
    } else {
      customer.cart.push({ product: productId, quantity: 1 });
    }

    await customer.save();
    await customer.populate({ path: 'cart.product', select: 'name price image category stock' });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: aliveLines(customer),
    });
  } catch (err) {
    next(err);
  }
}

// GET /cart  (protected)
// Current customer's cart only, with live products populated + quantities.
async function getCart(req, res, next) {
  try {
    const customer = await loadCustomerCart(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, count: customer.cart.length, cart: aliveLines(customer) });
  } catch (err) {
    next(err);
  }
}

// PATCH /cart/:productId  (protected)   body: { "quantity": 3 }
async function updateQuantity(req, res, next) {
  try {
    const { productId } = req.params;
    const { quantity } = req.body || {};

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Reject strings, floats, booleans, objects, arrays and null BEFORE any
    // comparison: otherwise "3" would silently pass as a valid quantity.
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a whole number' });
    }
    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const product = await Product.findById(productId).select('_id name stock');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const line = customer.cart.find((item) => item.product.equals(productId));
    if (!line) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available for ${product.name}`,
      });
    }

    line.quantity = quantity;
    await customer.save();
    await customer.populate({ path: 'cart.product', select: 'name price image category stock' });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: aliveLines(customer),
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /cart/:productId  (protected)
async function removeFromCart(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const line = customer.cart.find((item) => item.product.equals(productId));
    if (!line) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    customer.cart = customer.cart.filter((item) => !item.product.equals(productId));
    await customer.save();
    await customer.populate({ path: 'cart.product', select: 'name price image category stock' });

    // Populated for the same reason as every other cart response: the client
    // adopts whatever `cart` we return, so an unpopulated reply would leave
    // the UI rendering bare ObjectIds after a removal.
    res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      cart: aliveLines(customer),
    });
  } catch (err) {
    next(err);
  }
}

// Shared with the checkout flow: reload the authenticated customer's cart with
// live products, and report how many lines had to be dropped so checkout can
// explain itself instead of silently shrinking the cart.
async function loadCartWithProducts(userId) {
  const customer = await loadCustomerCart(userId);
  if (!customer) return null;
  const cart = aliveLines(customer);
  return { customer, cart, dropped: customer.cart.length - cart.length };
}

module.exports = { addToCart, getCart, updateQuantity, removeFromCart, loadCartWithProducts };