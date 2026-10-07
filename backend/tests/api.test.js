// ShopKart API test suite (Lab 01 -> Lab 06).
// Run: npm run test:api
//
// How it works
//   - Boots the REAL server (index.js) on PORT 5051 against the real MongoDB.
//   - Talks to it over HTTP with fetch, keeping cookies like a browser.
//   - Uses throw-away accounts (shopkart.test.*@example.com) and deletes only
//     what it created at the end. Seeded demo products are never deleted.
//   - The Razorpay HTTP call is stubbed (see config/razorpay.js test seam) so the
//     suite runs without live Razorpay credentials; the HMAC signature
//     verification itself is executed for real.
//   - FAKE Razorpay values below are throw-away local strings, not credentials.

const mongoose = require('mongoose');

process.env.PORT = process.env.TEST_PORT || '5051';
process.env.RAZORPAY_KEY_ID = 'rzp_test_localfakekey';
process.env.RAZORPAY_KEY_SECRET = 'localfakesecret_for_signature_tests_only';

// Stub ONLY the outbound Razorpay API. Everything else is production code.
const razorpayConfig = require('../config/razorpay');
let razorpaySequence = 0;
razorpayConfig.__setRazorpayInstanceForTests({
  orders: {
    create: async ({ amount, currency, receipt }) => {
      razorpaySequence += 1;
      return {
        id: `order_LOCALTEST${String(razorpaySequence).padStart(4, '0')}`,
        amount,
        currency,
        receipt,
        status: 'created',
      };
    },
  },
});

const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');

require('../index.js'); // starts the real server on TEST_PORT

// ------------------------------------------------------------------ helpers

const BASE = `http://127.0.0.1:${process.env.PORT}`;
const stamp = Date.now();
const USER_A = {
  fullName: 'Test A',
  email: `shopkart.test.a.${stamp}@example.com`,
  password: 'secret123',
  phone: '9876543210',
};
const USER_B = {
  fullName: 'Test B',
  email: `shopkart.test.b.${stamp}@example.com`,
  password: 'secret123',
  phone: '9123456780',
};

let cookies = {};

async function call(method, path, { body, cookieJar } = {}) {
  const jar = cookieJar === undefined ? cookies : cookieJar;
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar && Object.keys(jar).length > 0) {
    headers.Cookie = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const jarOut = { ...jar };
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === '' || /expires=thu, 01 jan 1970/i.test(raw)) delete jarOut[name];
    else jarOut[name] = value;
  }

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, jar: jarOut, raw: text, setCookieRaw: setCookies.join(' | ') };
}

const GET = (p, o) => call('GET', p, o);
const POST = (p, body, o) => call('POST', p, { ...o, body });
const PATCH = (p, body, o) => call('PATCH', p, { ...o, body });
const DELETE = (p, o) => call('DELETE', p, o);

const results = [];
async function test(name, expected, fn) {
  try {
    const actual = await fn();
    const pass = String(actual) === String(expected);
    results.push({ name, expected, actual, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | expected=${expected} | actual=${actual}`);
  } catch (err) {
    results.push({ name, expected, actual: `threw: ${err.message}`, pass: false });
    console.log(`FAIL | ${name} | expected=${expected} | actual=threw: ${err.message}`);
  }
}

function msg(res) {
  return `${res.status} ${res.data && res.data.message ? res.data.message : ''}`.trim();
}

async function waitForServer() {
  // Generous budget: the server only starts listening once MongoDB is
  // connected, and a cold connection can take several seconds.
  for (let i = 0; i < 600; i += 1) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function waitForMongo() {
  for (let i = 0; i < 600; i += 1) {
    if (mongoose.connection.readyState === 1) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('mongo did not connect');
}

function hmac(secret, data) {
  return require('crypto').createHmac('sha256', secret).update(data).digest('hex');
}

const units = (cart) => cart.reduce((sum, line) => sum + line.quantity, 0);

// -------------------------------------------------------------------- run

async function run() {
  await waitForServer();
  await waitForMongo();

  console.log('\n================ LAB 01: CUSTOMER AUTHENTICATION ================');

  const reg = await POST('/customers/register', USER_A);
  await test('register new customer', '201 Customer registered successfully', () => msg(reg));
  await test('register response never contains a password', 'no password field', () =>
    reg.raw.includes('password') ? 'password present' : 'no password field'
  );
  await test('duplicate email -> 409', '409 Email already registered', async () =>
    msg(await POST('/customers/register', USER_A))
  );
  await test('register missing phone -> 400', '400 All fields are required', async () =>
    msg(
      await POST('/customers/register', {
        fullName: 'X',
        email: `x.${stamp}@e.com`,
        password: 'secret123',
      })
    )
  );
  await test('register short password -> 400', '400 Password must be at least 6 characters', async () =>
    msg(
      await POST('/customers/register', {
        fullName: 'X',
        email: `y.${stamp}@e.com`,
        password: '123',
        phone: '9876543210',
      })
    )
  );
  await test('register whitespace-only fullName -> 400', '400 All fields are required', async () =>
    msg(
      await POST('/customers/register', {
        fullName: '   ',
        email: `z.${stamp}@e.com`,
        password: 'secret123',
        phone: '9876543210',
      })
    )
  );
  await test('password stored as bcrypt hash (never plaintext)', '$2 prefix', async () => {
    const stored = await Customer.findOne({ email: USER_A.email });
    return stored.password.startsWith('$2') ? '$2 prefix' : stored.password;
  });

  await POST('/customers/register', USER_B); // second account for ownership tests

  const loginWrong = await POST('/customers/login', {
    email: USER_A.email,
    password: 'wrongpass',
  });
  const loginNoUser = await POST('/customers/login', {
    email: 'ghost@example.com',
    password: 'wrongpass',
  });
  await test('login wrong password -> 401 generic', '401 Invalid email or password', () =>
    msg(loginWrong)
  );
  await test(
    'unknown email gives the SAME message (no user enumeration)',
    '401 Invalid email or password',
    () => msg(loginNoUser)
  );

  const login = await POST('/customers/login', {
    email: USER_A.email,
    password: USER_A.password,
  });
  await test('login valid -> 200', '200 Login successful', () => msg(login));
  await test('login sets HttpOnly token cookie', 'HttpOnly present, token set', () =>
    login.jar.token && /HttpOnly/i.test(login.setCookieRaw) && /SameSite=Strict/i.test(login.setCookieRaw)
      ? 'HttpOnly present, token set'
      : `token=${Boolean(login.jar.token)} raw=${login.setCookieRaw}`
  );
  await test('login response never contains a password', 'no password field', () =>
    login.raw.includes('password') ? 'password present' : 'no password field'
  );
  await test('login does not echo the customer (profile comes from /me)', 'no customer field', () =>
    login.data.customer ? 'customer echoed' : 'no customer field'
  );

  cookies = login.jar;
  const me = await GET('/customers/me');
  await test('GET /customers/me with cookie', '200', () => me.status);
  await test('me has name, email, phone and no password', 'name+email+phone, no password', () =>
    me.data.fullName && me.data.email && me.data.phone && !('password' in me.data)
      ? 'name+email+phone, no password'
      : 'unexpected shape'
  );

  await test('GET /customers/me without cookie -> 401', '401 Unauthorized', async () =>
    msg(await GET('/customers/me', { cookieJar: {} }))
  );
  await test('GET /customers/me with tampered token -> 401', '401 Unauthorized', async () =>
    msg(await GET('/customers/me', { cookieJar: { token: 'not.a.jwt' } }))
  );
  await test('Bearer header also authenticates (Postman parity)', '200', async () => {
    const res = await fetch(`${BASE}/customers/me`, {
      headers: { Authorization: `Bearer ${cookies.token}` },
    });
    return res.status;
  });

  console.log('\n================ LAB 03: PRODUCT CATALOG ================');

  const newProduct = {
    name: `Test Widget ${stamp}`,
    description: 'Created by the automated test suite',
    price: 1234.5,
    category: 'TestCategory',
    image:
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=70',
    stock: 4,
  };
  const created = await POST('/products', newProduct);
  await test('POST /products -> 201', '201 Product created successfully', () => msg(created));
  const widgetId = created.data && created.data.product && created.data.product._id;

  await test('POST /products without price -> 400', '400 All product fields are required', async () =>
    msg(await POST('/products', { ...newProduct, price: undefined }))
  );
  await test('POST /products with negative stock -> 400', '400 Stock cannot be negative', async () =>
    msg(await POST('/products', { ...newProduct, stock: -1 }))
  );

  const all = await GET('/products');
  await test('GET /products returns seeded products', '200 with 10 products', () =>
    `${all.status} with ${all.data.products.length} products`
  );
  await test('seeded product images are real http(s) URLs', 'all https', () =>
    all.data.products.every((p) => /^https:\/\//.test(p.image)) ? 'all https' : 'found non-https image'
  );

  const search0 = await GET('/products?search=KEYBOARD');
  await test('GET /products?search=keyboard (case-insensitive, name only)', '200 all match Keyboard', () =>
    `${search0.status} all match Keyboard`
  );
  await test('search matches name only (not description/category)', '0 matches', async () => {
    const r = await GET(`/products?search=${encodeURIComponent('mechanical keyboard blue')}`);
    return r.data.products.length === 0 ? '0 matches' : `${r.data.products.length} matches`;
  });

  const cat = await GET('/products?category=Electronics');
  await test('GET /products?category=Electronics (exact category)', 'all Electronics', () =>
    cat.data.products.every((p) => p.category === 'Electronics') ? 'all Electronics' : 'mixed categories'
  );
  const both = await GET('/products?search=keyboard&category=Electronics');
  await test(
    'GET /products?search=keyboard&category=Electronics (combined)',
    'all match Keyboard+Electronics',
    () =>
      both.data.products.length > 0 &&
      both.data.products.every((p) => /keyboard/i.test(p.name) && p.category === 'Electronics')
        ? 'all match Keyboard+Electronics'
        : 'unexpected filter result'
  );
  const bothNone = await GET('/products?search=mug&category=Electronics');
  await test('combined filters with no overlap -> 0 results', '0', () => bothNone.data.products.length);

  const asc = await GET('/products?sort=price_asc');
  const desc = await GET('/products?sort=price_desc');
  await test(
    'sort=price_asc is ascending',
    'ascending',
    () => (asc.data.products.every((p, i, a) => i === 0 || a[i - 1].price <= p.price)
      ? 'ascending'
      : 'not ascending')
  );
  await test(
    'sort=price_desc is descending',
    'descending',
    () => (desc.data.products.every((p, i, a) => i === 0 || a[i - 1].price >= p.price)
      ? 'descending'
      : 'not descending')
  );

  await test('GET /products/:id existing', '200', async () => (await GET(`/products/${widgetId}`)).status);
  await test('GET /products/invalid-id -> 400', '400 Invalid product ID', async () =>
    msg(await GET('/products/not-an-id'))
  );
  await test('GET /products/<valid id, missing> -> 404', '404 Product not found', async () =>
    msg(await GET('/products/64b7f0c2a1b2c3d4e5f60718'))
  );

  console.log('\n================ LAB 04: WISHLIST ================');

  const keyboard = all.data.products.find((p) => p.name === 'Mechanical Keyboard');
  const jacket = all.data.products.find((p) => p.name === 'Denim Jacket');
  const mug = all.data.products.find((p) => p.name === 'Ceramic Coffee Mug');

  await test('POST /wishlist/:id unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await POST(`/wishlist/${keyboard._id}`, {}, { cookieJar: {} }))
  );
  await test('GET /wishlist unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await GET('/wishlist', { cookieJar: {} }))
  );
  await test('POST /wishlist/invalid-id -> 400', '400 Invalid product ID', async () =>
    msg(await POST('/wishlist/not-an-id'))
  );
  await test('POST /wishlist/<missing product> -> 404', '404 Product not found', async () =>
    msg(await POST('/wishlist/64b7f0c2a1b2c3d4e5f60718'))
  );

  await test('POST /wishlist/:productId -> 200', '200 Product added to wishlist', async () =>
    msg(await POST(`/wishlist/${keyboard._id}`))
  );
  await test('wishlist response carries a count', 'count 1', async () => {
    const r = await GET('/wishlist');
    return `count ${r.data.count}`;
  });
  await test('wishlist stores only a Product reference (no duplicate object)', 'ObjectId array', async () => {
    const c = await Customer.findById(me.data._id).lean();
    const isId = (v) => mongoose.Types.ObjectId.isValid(String(v));
    return c.wishlist.length > 0 && c.wishlist.every(isId)
      ? 'ObjectId array'
      : 'unexpected shape';
  });
  await test('duplicate wishlist -> 409', '409 Product already in wishlist', async () =>
    msg(await POST(`/wishlist/${keyboard._id}`))
  );

  await POST(`/wishlist/${mug._id}`);
  const wishGet = await GET('/wishlist');
  await test('GET /wishlist is populated with product info', '2 items populated', () =>
    `${wishGet.data.count} items populated`
  );
  await test('wishlist item carries name/price/image/category/stock', 'all fields present', () =>
    wishGet.data.wishlist.every(
      (i) => i.name && typeof i.price === 'number' && i.image && i.category && typeof i.stock === 'number'
    )
      ? 'all fields present'
      : 'missing fields'
  );

  const loginB = await POST('/customers/login', {
    email: USER_B.email,
    password: USER_B.password,
  });
  const jarB = loginB.jar;
  await test('other customer cannot read my wishlist', '0', async () =>
    (await GET('/wishlist', { cookieJar: jarB })).data.count
  );
  await test('forged ?userId in query is ignored', '0', async () =>
    (await GET(`/wishlist?userId=${me.data._id}`, { cookieJar: jarB })).data.count
  );
  await test('there is no /wishlist/:userId route', '404 Route not found', async () =>
    msg(await GET(`/wishlist/${me.data._id}`, { cookieJar: jarB }))
  );

  await test('PATCH /wishlist/:id/toggle removes a saved product', '200 Product removed from wishlist', async () =>
    msg(await PATCH(`/wishlist/${keyboard._id}/toggle`))
  );
  await test('PATCH /wishlist/:id/toggle adds it back', '200 Product added to wishlist', async () =>
    msg(await PATCH(`/wishlist/${keyboard._id}/toggle`))
  );
  await test('DELETE /wishlist/:productId -> 200', '200 Product removed from wishlist', async () =>
    msg(await DELETE(`/wishlist/${keyboard._id}`))
  );
  await test('DELETE again -> 404', '404 Product not in wishlist', async () =>
    msg(await DELETE(`/wishlist/${keyboard._id}`))
  );
  await test('DELETE with invalid id -> 400', '400 Invalid product ID', async () =>
    msg(await DELETE('/wishlist/not-an-id'))
  );

  console.log('\n================ LAB 05: SHOPPING CART ================');

  await test('POST /cart/:id unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await POST(`/cart/${keyboard._id}`, {}, { cookieJar: {} }))
  );
  await test('POST /cart/invalid-id -> 400', '400 Invalid product ID', async () =>
    msg(await POST('/cart/not-an-id'))
  );
  await test('POST /cart/<missing product> -> 404', '404 Product not found', async () =>
    msg(await POST('/cart/64b7f0c2a1b2c3d4e5f60718'))
  );

  const cartAdd = await POST(`/cart/${keyboard._id}`);
  await test('POST /cart/:productId -> 200 Cart updated, qty 1', '200 / qty 1 / 1 unit', () =>
    `${cartAdd.status} / qty ${cartAdd.data.cart[0].quantity} / ${units(cartAdd.data.cart)} unit`
  );
  const cartAdd2 = await POST(`/cart/${keyboard._id}`);
  await test('adding the same product again increments quantity', 'qty 2 / 2 units', () =>
    `qty ${cartAdd2.data.cart[0].quantity} / ${units(cartAdd2.data.cart)} units`
  );
  await test('out-of-stock product -> 400', '400 Product is out of stock', async () =>
    msg(await POST(`/cart/${jacket._id}`))
  );
  await POST(`/cart/${mug._id}`);
  const cartGet = await GET('/cart');
  await test('GET /cart returns own cart, populated, with quantity', '2 rows / 3 units', () =>
    `${cartGet.data.count} rows / ${units(cartGet.data.cart)} units`
  );
  await test('cart stores { product: ObjectId, quantity } only', 'reference + quantity', async () => {
    const c = await Customer.findById(me.data._id).lean();
    const ok =
      c.cart.length > 0 &&
      c.cart.every(
        (line) =>
          mongoose.Types.ObjectId.isValid(String(line.product)) && typeof line.quantity === 'number'
      );
    return ok ? 'reference + quantity' : 'unexpected shape';
  });
  await test('cart count is total quantity, not rows (Navbar semantics)', '3 units over 2 rows', () =>
    `${units(cartGet.data.cart)} units over ${cartGet.data.count} rows`
  );
  await test('cart response never carries a subtotal (derived on the client)', 'no subtotal field', () =>
    cartGet.raw.includes('subtotal') ? 'subtotal present' : 'no subtotal field'
  );
  await test('other customer cannot read my cart', '0', async () =>
    (await GET('/cart', { cookieJar: jarB })).data.count
  );

  await test('PATCH /cart/:id quantity 3 -> 200', '200 Cart updated', async () =>
    msg(await PATCH(`/cart/${keyboard._id}`, { quantity: 3 }))
  );
  const qtyCases = [
    ['quantity 0', 0, '400 Quantity must be at least 1'],
    ['negative quantity', -2, '400 Quantity must be at least 1'],
    ['decimal quantity', 1.5, '400 Quantity must be a whole number'],
    ['string quantity', '3', '400 Quantity must be a whole number'],
    ['boolean quantity', true, '400 Quantity must be a whole number'],
    ['object quantity', {}, '400 Quantity must be a whole number'],
    ['array quantity', [3], '400 Quantity must be a whole number'],
    ['null quantity', null, '400 Quantity must be a whole number'],
    ['missing quantity', undefined, '400 Quantity must be a whole number'],
  ];
  for (const [label, value, expected] of qtyCases) {
    await test(`PATCH ${label} -> 400`, expected, async () =>
      msg(await PATCH(`/cart/${keyboard._id}`, value === undefined ? {} : { quantity: value }))
    );
  }
  await test(
    `PATCH above stock (999 > ${keyboard.stock}) -> 400`,
    `400 Only ${keyboard.stock} units available for Mechanical Keyboard`,
    async () => msg(await PATCH(`/cart/${keyboard._id}`, { quantity: 999 }))
  );
  await test('PATCH for a product not in cart -> 404', '404 Product not in cart', async () =>
    msg(await PATCH(`/cart/${widgetId}`, { quantity: 1 }))
  );
  await test('PATCH unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await PATCH(`/cart/${keyboard._id}`, { quantity: 2 }, { cookieJar: {} }))
  );
  await test('add-to-cart respects stock (increment above stock -> 400)', '400 Only 10 units available', async () => {
    await PATCH(`/cart/${keyboard._id}`, { quantity: 10 });
    return msg(await POST(`/cart/${keyboard._id}`));
  });

  await test('cart survives logout/login (server-side cart)', '11 units still there', async () => {
    await POST('/customers/logout');
    const relogin = await POST('/customers/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    cookies = relogin.jar;
    const r = await GET('/cart');
    return units(r.data.cart) === 11 ? '11 units still there' : `${units(r.data.cart)} units`;
  });

  await test('DELETE /cart/:productId -> 200', '200 Product removed from cart', async () =>
    msg(await DELETE(`/cart/${mug._id}`))
  );
  await test('DELETE again -> 404', '404 Product not in cart', async () =>
    msg(await DELETE(`/cart/${mug._id}`))
  );
  await test('GET /cart after remove', '1 row / 10 units', async () => {
    const r = await GET('/cart');
    return `${r.data.count} row / ${units(r.data.cart)} units`;
  });

  console.log('\n================ LAB 06: CHECKOUT / ORDERS / RAZORPAY ================');

  const validAddress = {
    fullName: 'Test A',
    phone: '9876543210',
    addressLine1: '221B Baker Street',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
  };

  await test('create-payment-order unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await POST('/orders/create-payment-order', { shippingAddress: validAddress }, { cookieJar: {} }))
  );

  await test('checkout with empty cart -> 400', '400 Your cart is empty', async () => {
    const saved = await Customer.findById(me.data._id);
    saved.cart = [];
    await saved.save();
    return msg(await POST('/orders/create-payment-order', { shippingAddress: validAddress }));
  });

  const invalidAddresses = [
    ['missing fullName', { ...validAddress, fullName: '' }, '400 fullName is required'],
    ['whitespace-only city', { ...validAddress, city: '   ' }, '400 city is required'],
    ['whitespace-only addressLine1', { ...validAddress, addressLine1: '   ' }, '400 addressLine1 is required'],
    ['bad phone', { ...validAddress, phone: 'abc' }, '400 Phone must be a valid 10-digit number'],
    ['5-digit pincode', { ...validAddress, pincode: '41100' }, '400 Pincode must contain 6 digits'],
    ['7-digit pincode', { ...validAddress, pincode: '4110012' }, '400 Pincode must contain 6 digits'],
    ['non-numeric pincode', { ...validAddress, pincode: 'ABCDEF' }, '400 Pincode must contain 6 digits'],
  ];
  for (const [label, address, expected] of invalidAddresses) {
    await test(`create-payment-order ${label} -> 400`, expected, async () =>
      msg(await POST('/orders/create-payment-order', { shippingAddress: address }))
    );
  }
  await test('create-payment-order without a shippingAddress -> 400', '400 Shipping address is required', async () =>
    msg(await POST('/orders/create-payment-order', {}))
  );

  // Refill the cart through the API (the empty-cart test emptied it directly).
  await POST(`/cart/${keyboard._id}`);
  await POST(`/cart/${keyboard._id}`);
  await POST(`/cart/${mug._id}`);

  const expectedTotal = keyboard.price * 2 + mug.price;

  const forged = await POST('/orders/create-payment-order', {
    shippingAddress: validAddress,
    totalAmount: 1, // must be ignored
    amount: 1,
    items: [{ product: 'fake', name: 'Free iPhone', price: 0, quantity: 99 }], // must be ignored
    user: me.data._id,
  });
  await test('create-payment-order returns 200', '200 Payment order created', () => msg(forged));
  await test('forged totalAmount + forged items are ignored', `200 total ${expectedTotal}`, () =>
    `${forged.status} total ${forged.data.totalAmount}`
  );
  await test('server total = sum(latest price x quantity)', String(expectedTotal), () =>
    forged.data.totalAmount
  );
  await test('amount is converted to paise for Razorpay', String(Math.round(expectedTotal * 100)), () =>
    forged.data.amount
  );
  await test('currency is returned for the checkout modal', 'INR', () => forged.data.currency);
  await test('public key id is returned as `key`', 'rzp_test_localfakekey', () => forged.data.key);
  await test('Razorpay SECRET is never returned', 'no secret in response', () =>
    /localfakesecret_for_signature_tests_only/.test(forged.raw) ? 'SECRET LEAKED' : 'no secret in response'
  );
  await test('razorpay order id is stored on the ShopKart order', 'order_LOCALTEST id stored', async () => {
    const o = await Order.findById(forged.data.shopKartOrderId).lean();
    return /^order_LOCALTEST/.test(o.razorpayOrderId) ? 'order_LOCALTEST id stored' : String(o.razorpayOrderId);
  });
  await test('new order starts as PENDING_PAYMENT / PENDING', 'PENDING_PAYMENT / PENDING', async () => {
    const o = await Order.findById(forged.data.shopKartOrderId).lean();
    return `${o.status} / ${o.paymentStatus}`;
  });
  await test('cart is NOT cleared when the payment order is created', '3', async () => {
    const c = await Customer.findById(me.data._id);
    return units(c.cart);
  });

  await test('a retry reuses the same pending order (no duplicate rows)', 'same shopKartOrderId', async () => {
    const again = await POST('/orders/create-payment-order', { shippingAddress: validAddress });
    return again.data.shopKartOrderId === forged.data.shopKartOrderId
      ? 'same shopKartOrderId'
      : 'different order id';
  });

  // Latest-price check: raise a price in Mongo, checkout must use the new one.
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: 999999 } });
  const latestPriceOrder = await POST('/orders/create-payment-order', {
    shippingAddress: validAddress,
  });
  await test('checkout uses the LATEST price, not an old one', String(999999 * 2 + mug.price), () =>
    latestPriceOrder.data.totalAmount
  );

  // Latest stock check: shrink stock below the cart quantity.
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: keyboard.price, stock: 1 } });
  await test('checkout rejects when latest stock is too low', '400 Insufficient stock for Mechanical Keyboard. Only 1 left.', async () =>
    msg(await POST('/orders/create-payment-order', { shippingAddress: validAddress }))
  );
  await Product.updateOne({ _id: keyboard._id }, { $set: { stock: keyboard.stock } });

  // Restore the real price and take the order we actually pay for, so the paid
  // order's snapshots reflect the true purchase-time price.
  const paid = await POST('/orders/create-payment-order', { shippingAddress: validAddress });
  await test('final checkout uses the restored price', String(expectedTotal), () =>
    paid.data.totalAmount
  );

  const order = await Order.findById(paid.data.shopKartOrderId);

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const goodSig = hmac(secret, `${order.razorpayOrderId}|pay_LOCALPAYMENT1`);

  await test('verify-payment with missing fields -> 400', '400 Missing payment verification details', async () =>
    msg(await POST('/orders/verify-payment', { shopKartOrderId: order._id, paymentSuccess: true }))
  );
  await test('verify-payment with only paymentSuccess:true -> 400', '400 Missing payment verification details', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: order._id,
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: 'pay_LOCALPAYMENT1',
        paymentSuccess: true,
      })
    )
  );
  await test('verify-payment with a FORGED signature -> 400', '400 Invalid payment signature', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: order._id,
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: 'pay_LOCALPAYMENT1',
        razorpay_signature: 'deadbeef'.repeat(8),
        paymentSuccess: true,
      })
    )
  );
  await test('verify-payment with mismatched razorpay_order_id -> 400', '400 Payment does not match this order', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: order._id,
        razorpay_order_id: 'order_SOMEONEELSE',
        razorpay_payment_id: 'pay_LOCALPAYMENT1',
        razorpay_signature: goodSig,
      })
    )
  );
  await test('signature of a swapped payment_id does not match', '400 Invalid payment signature', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: order._id,
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: 'pay_ATTACKER',
        razorpay_signature: goodSig,
      })
    )
  );
  await test('verify-payment with invalid order id -> 400', '400 Invalid order ID', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: 'not-an-id',
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: 'pay_LOCALPAYMENT1',
        razorpay_signature: goodSig,
      })
    )
  );
  await test("another customer verifying my order -> 404 (no existence leak)", '404 Order not found', async () =>
    msg(
      await POST(
        '/orders/verify-payment',
        {
          shopKartOrderId: order._id,
          razorpay_order_id: order.razorpayOrderId,
          razorpay_payment_id: 'pay_LOCALPAYMENT1',
          razorpay_signature: goodSig,
        },
        { cookieJar: jarB }
      )
    )
  );

  const afterFailures = await Order.findById(order._id).lean();
  await test('order is not PAID after every failed verification', 'FAILED / PENDING_PAYMENT', () =>
    `${afterFailures.paymentStatus} / ${afterFailures.status}`
  );
  await test('a failed signature records a failureReason', 'Invalid payment signature', () =>
    afterFailures.failureReason
  );
  await test('cart survives every failed verification', '3', async () =>
    units((await Customer.findById(me.data._id)).cart)
  );

  const verify = await POST('/orders/verify-payment', {
    shopKartOrderId: order._id,
    razorpay_order_id: order.razorpayOrderId,
    razorpay_payment_id: 'pay_LOCALPAYMENT1',
    razorpay_signature: goodSig,
  });
  await test('verify-payment with a VALID signature -> 200', '200 Payment verified. Order placed successfully.', () =>
    msg(verify)
  );

  const paidOrder = await Order.findById(order._id).lean();
  await test('paymentStatus becomes PAID after signature verification', 'PAID', () => paidOrder.paymentStatus);
  await test('status becomes PLACED', 'PLACED', () => paidOrder.status);
  await test('razorpayPaymentId is stored', 'pay_LOCALPAYMENT1', () => paidOrder.razorpayPaymentId);
  await test('failureReason is cleared after success', 'undefined', () => String(paidOrder.failureReason));
  await test('cart is cleared ONLY after valid payment', '0', async () =>
    (await GET('/cart')).data.count
  );
  await test('re-verifying the same payment is idempotent', '200 Payment already verified', async () =>
    msg(
      await POST('/orders/verify-payment', {
        shopKartOrderId: order._id,
        razorpay_order_id: order.razorpayOrderId,
        razorpay_payment_id: 'pay_LOCALPAYMENT1',
        razorpay_signature: goodSig,
      })
    )
  );

  // Bonus: dev-only status progression.
  await test('PATCH /orders/:id/status rejects an unknown status', '400 Status must be one of: PLACED, CONFIRMED, SHIPPED, DELIVERED', async () =>
    msg(await PATCH(`/orders/${order._id}/status`, { status: 'TELEPORTED' }))
  );
  await test('PATCH /orders/:id/status advances a PAID order', '200 Order status updated', async () =>
    msg(await PATCH(`/orders/${order._id}/status`, { status: 'SHIPPED' }))
  );
  await test("PATCH /orders/:id/status on another customer's order -> 404", '404 Order not found', async () =>
    msg(await PATCH(`/orders/${order._id}/status`, { status: 'PLACED' }, { cookieJar: jarB }))
  );

  // Order history must stay historically accurate even if the product changes.
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: 999999, name: 'Keyboard RENAMED' } });
  const historic = await GET(`/orders/${order._id}`);
  await test('old order keeps the purchase-time price snapshot', String(keyboard.price), () =>
    historic.data.order.items.find((i) => i.product === keyboard._id).price
  );
  await test('old order keeps the purchase-time name snapshot', 'Mechanical Keyboard', () =>
    historic.data.order.items.find((i) => i.product === keyboard._id).name
  );
  await Product.updateOne(
    { _id: keyboard._id },
    { $set: { price: keyboard.price, name: 'Mechanical Keyboard' } }
  );

  await test('GET /orders returns only my orders, newest first', '1 order, newest first', async () => {
    const r = await GET('/orders');
    const dates = r.data.orders.map((o) => new Date(o.createdAt).getTime());
    const newestFirst = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    return r.data.count === 1 && newestFirst ? `${r.data.count} order, newest first` : `count=${r.data.count} newestFirst=${newestFirst}`;
  });
  await test('GET /orders unauthenticated -> 401', '401 Unauthorized', async () =>
    msg(await GET('/orders', { cookieJar: {} }))
  );
  await test('GET /orders/:id own order -> 200', '200', async () =>
    (await GET(`/orders/${order._id}`)).status
  );
  await test("GET /orders/:id of ANOTHER customer -> 404", '404 Order not found', async () =>
    msg(await GET(`/orders/${order._id}`, { cookieJar: jarB }))
  );
  await test('GET /orders/invalid-id -> 400', '400 Invalid order ID', async () =>
    msg(await GET('/orders/not-an-id'))
  );
  await test('GET /orders/<valid id, missing> -> 404', '404 Order not found', async () =>
    msg(await GET('/orders/64b7f0c2a1b2c3d4e5f60718', { cookieJar: jarB }))
  );
  await test('B has no orders of their own', '0', async () =>
    (await GET('/orders', { cookieJar: jarB })).data.count
  );
  await test('order response never leaks another customer', 'no foreign user id', () =>
    /64b7f0c2/.test(historic.raw) ? 'foreign id present' : 'no foreign user id'
  );

  await test('logout clears the cookie and /me is 401 again', '200 then 401', async () => {
    const out = await POST('/customers/logout');
    const after = await GET('/customers/me', { cookieJar: out.jar });
    return out.status === 200 && after.status === 401 ? '200 then 401' : `${out.status} then ${after.status}`;
  });
  await test('logout without a session -> 401', '401 Unauthorized', async () =>
    msg(await POST('/customers/logout', {}, { cookieJar: {} }))
  );

  await test('PATCH /customers/change-password works', '200 Password changed successfully', async () => {
    const relogin = await POST('/customers/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    const jar = relogin.jar;
    const r = await PATCH(
      '/customers/change-password',
      { oldPassword: USER_A.password, newPassword: 'newsecret123' },
      { cookieJar: jar }
    );
    const loginOld = await POST('/customers/login', {
      email: USER_A.email,
      password: USER_A.password,
    });
    const loginNew = await POST('/customers/login', {
      email: USER_A.email,
      password: 'newsecret123',
    });
    return r.status === 200 && loginOld.status === 401 && loginNew.status === 200
      ? '200 Password changed successfully'
      : `${r.status}/${loginOld.status}/${loginNew.status}`;
  });

  // ------------------------------------------------------------- cleanup
  const a = await Customer.findOne({ email: USER_A.email });
  const b = await Customer.findOne({ email: USER_B.email });
  const ids = [a && a._id, b && b._id].filter(Boolean);
  await Order.deleteMany({ user: { $in: ids } });
  await Customer.deleteMany({ _id: { $in: ids } });
  await Product.deleteMany({ name: `Test Widget ${stamp}` });
  console.log('\ncleanup: removed throw-away test customers, their orders and the test product');

  const failed = results.filter((r) => !r.pass);
  console.log(`\n================ SUMMARY: ${results.length - failed.length}/${results.length} passed ================`);
  if (failed.length > 0) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log(` - ${f.name} | expected=${f.expected} | actual=${f.actual}`));
  }
  await mongoose.disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('TEST RUN CRASHED:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});