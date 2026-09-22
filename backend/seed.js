// Seed demo products for Lab 03 (run: npm run seed).
// Requires MONGO_URI in .env. Clears + inserts 8 sample products.

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Product = require('./models/product.model');

dotenv.config();

const demoProducts = [
  {
    name: 'Noise Cancelling Headphones',
    description: 'Wireless over-ear headphones with active noise cancellation.',
    price: 4999,
    category: 'Electronics',
    image: 'https://via.placeholder.com/400x300?text=Headphones',
    stock: 25,
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with blue switches.',
    price: 2999,
    category: 'Electronics',
    image: 'https://via.placeholder.com/400x300?text=Keyboard',
    stock: 10,
  },
  {
    name: 'Cotton T-Shirt',
    description: 'Comfortable 100% cotton t-shirt for everyday wear.',
    price: 499,
    category: 'Fashion',
    image: 'https://via.placeholder.com/400x300?text=T-Shirt',
    stock: 100,
  },
  {
    name: 'Denim Jacket',
    description: 'Classic denim jacket with a modern fit.',
    price: 1999,
    category: 'Fashion',
    image: 'https://via.placeholder.com/400x300?text=Jacket',
    stock: 0,
  },
  {
    name: 'JavaScript Handbook',
    description: 'Beginner-friendly guide to modern JavaScript.',
    price: 799,
    category: 'Books',
    image: 'https://via.placeholder.com/400x300?text=JS+Book',
    stock: 50,
  },
  {
    name: 'Ceramic Coffee Mug',
    description: 'Handcrafted ceramic mug, 350ml capacity.',
    price: 299,
    category: 'Home',
    image: 'https://via.placeholder.com/400x300?text=Mug',
    stock: 75,
  },
  {
    name: 'Smartphone Stand',
    description: 'Adjustable aluminium stand for phones and tablets.',
    price: 899,
    category: 'Electronics',
    image: 'https://via.placeholder.com/400x300?text=Stand',
    stock: 40,
  },
  {
    name: 'Cooking Essentials Book',
    description: '100 quick recipes for busy home cooks.',
    price: 649,
    category: 'Books',
    image: 'https://via.placeholder.com/400x300?text=Cookbook',
    stock: 30,
  },
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env file');
    await mongoose.connect(process.env.MONGO_URI);
    await Product.deleteMany({});
    await Product.insertMany(demoProducts);
    console.log(`Seeded ${demoProducts.length} products`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
