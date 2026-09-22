// Customer model (Mongoose schema)
// Demonstrates: required fields, unique email, lowercase normalization,
// trim, minlength, and timestamps (createdAt + updatedAt).

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  },
  {
    timestamps: true, // auto-adds createdAt and updatedAt
  }
);

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
