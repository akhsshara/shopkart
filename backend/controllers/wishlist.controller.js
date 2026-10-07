// Wishlist controllers (Lab 04).
//
// The wishlist lives INSIDE the Customer document as an array of Product
// ObjectIds (no duplicated product objects). Ownership always comes from the
// JWT (req.user set by auth middleware) - a userId sent by the browser is
// never read, so nobody can touch anybody else's wishlist.

const mongoose = require('mongoose');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Re-read the saved customer document and hydrate the ObjectId references into
// product documents. Returns null when the customer no longer exists.
async function getWishlistDoc(userId) {
  return Customer.findById(userId).populate({
    path: 'wishlist',
    select: 'name price category image stock',
  });
}

// POST /wishlist/:productId  (protected)
// Add a Product reference to the logged-in customer's wishlist.
async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // req.user is projected without the password, so it cannot be saved
    // directly -> reload the full document before mutating it.
    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Duplicate -> 409. Membership is checked explicitly because $addToSet
    // alone would silently succeed and never report the conflict.
    if (customer.wishlist.some((id) => id.equals(product._id))) {
      return res.status(409).json({ success: false, message: 'Product already in wishlist' });
    }

    customer.wishlist.push(product._id);
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      count: customer.wishlist.length,
    });
  } catch (err) {
    next(err);
  }
}

// GET /wishlist  (protected)
// Only the CURRENT customer's wishlist. There is intentionally no
// GET /wishlist/:userId route.
async function getWishlist(req, res, next) {
  try {
    const customer = await getWishlistDoc(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // populate() leaves a null hole if a product was deleted after being saved.
    const wishlist = customer.wishlist.filter(Boolean);

    res.status(200).json({ success: true, count: wishlist.length, wishlist });
  } catch (err) {
    next(err);
  }
}

// DELETE /wishlist/:productId  (protected)
async function removeFromWishlist(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!customer.wishlist.some((id) => id.equals(productId))) {
      return res.status(404).json({ success: false, message: 'Product not in wishlist' });
    }

    customer.wishlist = customer.wishlist.filter((id) => !id.equals(productId));
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      count: customer.wishlist.length,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /wishlist/:productId/toggle  (protected, bonus)
// One action that adds when absent and removes when present, so the UI button
// can live in one place without tracking two endpoints.
async function toggleWishlist(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const customer = await Customer.findById(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existing = customer.wishlist.some((id) => id.equals(product._id));
    customer.wishlist = existing
      ? customer.wishlist.filter((id) => !id.equals(product._id))
      : [...customer.wishlist, product._id];

    await customer.save();

    res.status(200).json({
      success: true,
      message: existing ? 'Product removed from wishlist' : 'Product added to wishlist',
      inWishlist: !existing,
      count: customer.wishlist.length,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { addToWishlist, getWishlist, removeFromWishlist, toggleWishlist };