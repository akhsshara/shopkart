// Wishlist routes (Lab 04): URL -> controller mapping.
// Every route is behind `authenticate` (JWT cookie -> req.user). There is
// deliberately no GET /wishlist/:userId: the client must never choose whose
// wishlist it reads.

const express = require('express');
const {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  toggleWishlist,
} = require('../controllers/wishlist.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/:productId', authenticate, addToWishlist);
router.get('/', authenticate, getWishlist);
router.delete('/:productId', authenticate, removeFromWishlist);
router.patch('/:productId/toggle', authenticate, toggleWishlist); // bonus

module.exports = router;