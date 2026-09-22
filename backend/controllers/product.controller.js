// Product controllers (Lab 03).
// POST /products, GET /products (search/filter/sort), GET /products/:id

const mongoose = require('mongoose');
const Product = require('../models/product.model');

// POST /products (open API for this lab; admin auth comes later)
async function createProduct(req, res, next) {
  try {
    const { name, description, price, category, image, stock } = req.body;

    if (
      name === undefined ||
      description === undefined ||
      price === undefined ||
      category === undefined ||
      image === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({ success: false, message: 'All product fields are required' });
    }

    // Explicit checks give clean 400s before Mongoose validation
    if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a number greater than 0' });
    }
    if (typeof stock !== 'number' || Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
    }

    const product = await Product.create({ name, description, price, category, image, stock });

    res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    next(err); // ValidationError -> 400 via error.middleware
  }
}

// GET /products?search=keyboard&category=Electronics&sort=price_asc|price_desc
async function getProducts(req, res, next) {
  try {
    const { search, category, sort } = req.query;
    const query = {};

    // Case-insensitive partial match on name
    if (search && String(search).trim() !== '') {
      query.name = { $regex: String(search).trim(), $options: 'i' };
    }

    if (category && String(category).trim() !== '') {
      query.category = String(category).trim();
    }

    let cursor = Product.find(query);

    // Bonus: sorting by price
    if (sort === 'price_asc') {
      cursor = cursor.sort({ price: 1 });
    } else if (sort === 'price_desc') {
      cursor = cursor.sort({ price: -1 });
    }

    const products = await cursor.exec();

    res.status(200).json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
}

// GET /products/:id
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

module.exports = { createProduct, getProducts, getProductById };
