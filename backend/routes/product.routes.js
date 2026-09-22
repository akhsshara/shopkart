// Product routes: URL -> controller mapping (Lab 03, MVC).

const express = require('express');
const { createProduct, getProducts, getProductById } = require('../controllers/product.controller');

const router = express.Router();

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);

module.exports = router;
