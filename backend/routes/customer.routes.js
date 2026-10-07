// Customer routes: URL -> controller mapping.
// The `authenticate` guard runs before every private handler (GET /me,
// POST /logout, PATCH /change-password).

const express = require('express');
const {
  registerCustomer,
  loginCustomer,
  getProfile,
  logoutCustomer,
  changePassword,
} = require('../controllers/customer.controller');
const authenticate = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', registerCustomer);
router.post('/login', loginCustomer);
router.get('/me', authenticate, getProfile);
router.post('/logout', authenticate, logoutCustomer);
router.patch('/change-password', authenticate, changePassword);

module.exports = router;
