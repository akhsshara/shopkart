// Order model (Lab 06).
//
// Design rule: an order is a HISTORICAL RECORD. Every field the customer was
// charged / shown at purchase time is stored as a SNAPSHOT (name, price,
// image) next to the live Product reference. If the Product document later
// changes (price 2999 -> 999999), the old order still shows 2999.
//
// Subtotals and totals are computed on the SERVER from live Product documents
// at checkout time - they are never accepted from the browser and never
// derived from what the frontend displays.

const mongoose = require('mongoose');

// ---- Purchase-time snapshot of one cart line ----
const orderItemSchema = new mongoose.Schema(
  {
    // Live reference (kept for analytics / future stock sync). May later point
    // at a deleted product - the snapshot fields are what the UI renders.
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Order item name is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Order item price is required'],
      min: [0, 'Order item price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Order item quantity is required'],
      min: [1, 'Order item quantity must be at least 1'],
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: false, _id: false }
);

// ---- Shipping address captured at checkout ----
// Field-level validation lives in order.controller.js (it runs before any write
// and produces actionable messages), so the schema stays permissive: an order
// written by an older/other client must still load instead of failing to
// validate.
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { timestamps: false, _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Ownership: the existing Customer model is the single user entity.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Order must belong to a customer'],
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order must contain at least one item'],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    // Server-calculated: sum(latestProduct.price * quantity)
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'],
      default: 'PENDING_PAYMENT',
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    // Why a verification attempt failed (e.g. a bad signature). Diagnostic only
    // - it is never trusted to decide whether a payment succeeded.
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt = order date shown in UI
  }
);

module.exports = mongoose.model('Order', orderSchema);