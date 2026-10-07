// Order routes (Lab 06): URL -> controller mapping.
// All routes are behind `authenticate` (JWT cookie -> req.user). Every
// controller matches on `user: req.user._id`, so a guessed order id cannot be
// read or modified by another customer.

const express = require('express');
const {
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/order.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/create-payment-order', authenticate, createPaymentOrder);
router.post('/verify-payment', authenticate, verifyPayment);
router.get('/', authenticate, getMyOrders);
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/status', authenticate, updateOrderStatus); // bonus, dev only

module.exports = router;