const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback error
}

// Seed demo products (Lab 03 data for Lab 04-06 too).
// Run with: npm run seed
//
// SAFETY: this script NEVER wipes the database and never deletes products.
// It upserts by product name, so it can be re-run any number of times and
// existing products/cart/wishlist references stay valid.
//
// Image URLs are real, publicly reachable Unsplash photos (verified live) and
// are stored in MongoDB - they are NOT hardcoded anywhere in React.

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Product = require('./models/product.model');

dotenv.config();

const IMAGE = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

const demoProducts = [
  {
    name: 'Noise Cancelling Headphones',
    description: 'Wireless over-ear headphones with active noise cancellation and 30h battery.',
    price: 4999,
    category: 'Electronics',
    image: IMAGE('photo-1546435770-a3e426bf472b'),
    stock: 25,
  },
  {
    name: 'Mechanical Keyboard',
    description: 'Wireless mechanical keyboard with tactile blue switches and backlit keys.',
    price: 2999,
    category: 'Electronics',
    image: IMAGE('photo-1587829741301-dc798b83add3'),
    stock: 10,
  },
  {
    name: '27-inch LED Monitor',
    description: 'Full HD IPS display, 75Hz refresh rate with thin bezels and HDMI/VGA ports.',
    price: 18999,
    category: 'Electronics',
    image: IMAGE('photo-1527443224154-c4a3942d3acf'),
    stock: 12,
  },
  {
    name: 'Cotton T-Shirt',
    description: 'Comfortable 100% combed cotton t-shirt with a relaxed fit.',
    price: 499,
    category: 'Fashion',
    image: IMAGE('photo-1521572163474-6864f9cf17ab'),
    stock: 100,
  },
  {
    name: 'Denim Jacket',
    description: 'Classic light-wash denim jacket with a modern regular fit.',
    price: 1999,
    category: 'Fashion',
    image: IMAGE('photo-1516257984-b1b4d707412e'),
    stock: 0, // intentionally out of stock (used to demo stock handling)
  },
  {
    name: 'JavaScript Handbook',
    description: 'Beginner-friendly guide to modern JavaScript, async patterns and the DOM.',
    price: 799,
    category: 'Books',
    image: IMAGE('photo-1461749280684-dccba630e2f6'),
    stock: 50,
  },
  {
    name: 'Cooking Essentials Book',
    description: '100 quick and easy recipes for busy home cooks, step by step.',
    price: 649,
    category: 'Books',
    image: IMAGE('photo-1543002588-bfa74002ed7e'),
    stock: 30,
  },
  {
    name: 'Ceramic Coffee Mug',
    description: 'Handcrafted ceramic mug, 350ml capacity, dishwasher safe.',
    price: 299,
    category: 'Home',
    image: IMAGE('photo-1514228742587-6b1558fcca3d'),
    stock: 75,
  },
  {
    name: 'Minimalist Desk Lamp',
    description: 'Matte black adjustable desk lamp with a warm LED bulb included.',
    price: 1799,
    category: 'Home',
    image: IMAGE('photo-1507473885765-e6ed057f782c'),
    stock: 18,
  },
  {
    name: 'iPhone 18 Pro Max',
    description:
      'Apple iPhone 18 Pro Max - 6.9-inch Super Retina XDR display, A20 Pro chip, 48MP triple camera system and all-day battery life.',
    price: 189999,
    category: 'Electronics',
    image: IMAGE('photo-1523206489230-c012c64b2b48'),
    stock: 15,
  },
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env file');
    await mongoose.connect(process.env.MONGO_URI.trim());

    let created = 0;
    let updated = 0;

    for (const demo of demoProducts) {
      const { _id, createdAt, updatedAt, ...fields } = demo; // eslint-disable-line no-unused-vars
      // Upsert by name: existing products keep their _id (so carts, wishlists
      // and old orders stay valid); their content is refreshed with the demo
      // values (this is what replaces dead placeholder image URLs).
      const existing = await Product.findOne({ name: fields.name }).select('_id');

      if (existing) {
        await Product.updateOne({ _id: existing._id }, { $set: fields });
        updated += 1;
      } else {
        await Product.create(fields);
        created += 1;
      }
    }

    const total = await Product.countDocuments();
    console.log(`Seed complete: ${created} created, ${updated} updated, ${total} product(s) in DB`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();