// Cart routes (Lab 05): URL -> controller mapping.
// Every route is behind `protect` (JWT cookie -> req.user).

const express = require('express');
const {
  addToCart,
  getCart,
  updateQuantity,
  removeFromCart,
} = require('../controllers/cart.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/:productId', authenticate, addToCart);
router.get('/', authenticate, getCart);
router.patch('/:productId', authenticate, updateQuantity);
router.delete('/:productId', authenticate, removeFromCart);

module.exports = router;