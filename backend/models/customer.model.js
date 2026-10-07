// Customer model (Mongoose schema)
// Demonstrates: required fields, unique email, lowercase normalization,
// trim, minlength, and timestamps (createdAt + updatedAt).
//
// Lab 04/05 extend this SAME model (never a second User model) with two
// arrays of references: `wishlist` (Product ObjectIds) and `cart`
// ({ product: ObjectId, quantity }). Only references are stored - never full
// duplicated Product documents - so price/stock always stay authoritative in
// the products collection.

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// One cart line: a Product reference + how many units the customer wants.
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
  },
  { timestamps: false }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // creates a unique index -> duplicate email throws E11000
      lowercase: true, // normalize: John@Gmail.com -> john@gmail.com
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },

    // ---- Lab 04: wishlist (just Product references) ----
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      default: [],
    },

    // ---- Lab 05: cart (Product reference + quantity) ----
    cart: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true, // auto-adds createdAt and updatedAt
  }
);

// Defense in depth: even if a controller ever forgets to hand-pick fields,
// `res.json(customer)` can never serialize the password hash.
customerSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

// Hash password automatically before saving.
// Runs on register AND on change-password (save() triggers it).
// isModified check avoids re-hashing when only name/phone changes.
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Customer', customerSchema);
