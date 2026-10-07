# ShopKart Secure — Backend Authentication Service

## 1. Project Overview

Individual engineering lab project demonstrating backend authentication with **only**:

- Node.js + Express.js (server + routing)
- MongoDB + Mongoose (database + ODM)
- bcrypt (password hashing)
- jsonwebtoken (JWT sessions)
- cookie-parser (HttpOnly cookie sessions)
- dotenv (environment variables)

No Passport.js, Clerk, Firebase, Auth0, or any auth framework.

MVC architecture:

| Layer | Folder | Responsibility |
|---|---|---|
| Model | `models/customer.model.js` | Mongoose schema, validation, password hashing hook |
| Controller | `controllers/customer.controller.js` | Register / login / profile / logout / change-password logic |
| Routes | `routes/customer.routes.js` | URL mapping + `protect` guard |
| Middleware | `middlewares/` | JWT auth + centralized errors |
| Utility | `utils/generateToken.js` | JWT creation + cookie setting |
| Entry | `index.js` | Express setup, MongoDB connection, server start |

## 2. Installation

```bash
cd backend
npm install
```

Requires Node.js 18+.

## 3. Environment Variables

Copy the example file and fill in your own values:

```bash
copy .env.example .env
```

`.env`:

```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/shopkart?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret_string
NODE_ENV=development
```

- Never hardcode `MONGO_URI` or `JWT_SECRET` in code.
- Never commit `.env` (it is in `.gitignore`).
- Generate a strong secret, e.g. 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## 4. MongoDB Atlas Setup

1. Create account at https://cloud.mongodb.com.
2. Create a free cluster (M0).
3. Database Access → Add user (username + password) → Built-in role: Read and write.
4. Network Access → Add IP → `0.0.0.0/0` (for lab/demo only).
5. Cluster → Connect → Drivers → Node.js → copy connection string.
6. Paste it into `.env` as `MONGO_URI` (replace `<username>`, `<password>`).
7. Append a database name, e.g. `...mongodb.net/shopkart?...`.

## 5. Running the Server

```bash
# development (auto-restart on save, Node 18+)
npm run dev

# production
npm start
```

Expected output:

```
MongoDB connected
ShopKart Secure running on port 5000
```

Health check: `GET http://localhost:5000/` → `{ "success": true, "message": "ShopKart Secure API is running" }`.

## 6. API Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/customers/register` | No | Register customer |
| POST | `/customers/login` | No | Login, sets HttpOnly `token` cookie |
| GET | `/customers/me` | Yes (cookie) | Current customer profile |
| POST | `/customers/logout` | No | Clear `token` cookie |
| PATCH | `/customers/change-password` | Yes (cookie) | Verify old password, save new hash |

### Register

```json
POST /customers/register
{ "fullName": "John Doe", "email": "john@gmail.com", "password": "john123", "phone": "9876543210" }
```

- `201` → `{ "success": true, "message": "Customer registered successfully", "customer": {...} }`
- `400` → missing/invalid fields, password < 6 chars
- `409` → email already registered

### Login

```json
POST /customers/login
{ "email": "john@gmail.com", "password": "john123" }
```

- `200` + `Set-Cookie: token=...; HttpOnly` + customer JSON (no password)
- `401` → `{ "success": false, "message": "Invalid email or password" }` (same message for wrong email or wrong password)

Cookie: `httpOnly: true`, `secure: (NODE_ENV === 'production')`, `sameSite: 'strict'`, `maxAge: 7 days`.

### Profile

```
GET /customers/me   (with token cookie)
```

- `200` → `{ "_id", "fullName", "email", "phone" }`
- `401` → missing/invalid token

### Logout

```
POST /customers/logout
```

- `200` → `{ "success": true, "message": "Logged out successfully" }` + cleared cookie

### Change Password (bonus)

```json
PATCH /customers/change-password   (with token cookie)
{ "oldPassword": "john123", "newPassword": "newpassword123" }
```

- Verifies old password with `bcrypt.compare`, hashes new password, saves hash, never returns password.

## 7. Postman Testing Sequence

1. **Health**: `GET /` → expect `200`.
2. **Register**: `POST /customers/register` with the JSON above → expect `201`.
3. **Register duplicate**: same request again → expect `409`.
4. **Register validation**: omit `phone` or use 3-char password → expect `400`.
5. **Login wrong password**: `POST /customers/login` with wrong password → expect `401` generic message.
6. **Login correct**: correct credentials → expect `200` + `token` cookie (Postman: check Cookies tab; cookie is HttpOnly so it won't show in body).
7. **Profile without cookie**: `GET /customers/me` in a new tab/session without cookies → expect `401`.
8. **Profile with cookie**: same request in the logged-in session → expect `200` with profile, no password field.
9. **Change password**: `PATCH /customers/change-password` → expect `200`.
10. **Login with old password** → expect `401`; **login with new password** → expect `200`.
11. **Logout**: `POST /customers/logout` → expect `200`; then `GET /me` → expect `401`.
12. **MongoDB check**: Atlas → Browse Collections → `customers` document has a `$2b$...` bcrypt hash in `password`, never plaintext, plus `createdAt`/`updatedAt`.

> Postman tip: enable the cookie jar so the `token` cookie is sent automatically after login.

## 8. Security Decisions

- **bcrypt hashing** (`genSalt(10)` + `hash` in `pre('save')` hook): passwords are never stored or logged in plaintext; `isModified` check prevents double-hashing.
- **Generic login errors**: identical `401` for unknown email vs wrong password, so attackers can't enumerate accounts.
- **JWT in HttpOnly cookie** (not localStorage): browser JS can't read it → mitigates XSS token theft.
- **`secure` flag in production**: cookie sent only over HTTPS when `NODE_ENV=production`.
- **`sameSite: 'strict'`**: cookie not sent on cross-site requests → mitigates CSRF.
- **No password in responses or JWT payload**: controllers return only `_id/fullName/email/phone`; token payload is only `{ id }`.
- **Email normalization**: `trim` + `lowercase` prevents `John@Gmail.com` vs `john@gmail.com` duplicates.
- **Centralized error middleware**: consistent `{ success, message }` format; duplicate-key `11000` mapped to `409`.
- **Secrets in `.env` only**: `MONGO_URI`/`JWT_SECRET` validated at startup; server exits with a safe message (no credentials logged) if missing or DB unreachable.
- **What is intentionally NOT covered** (kept simple for lab scope): rate limiting, refresh-token rotation, email verification, RBAC/roles.

## 9. Viva Questions and Answers

**Q1. Why bcrypt and not plaintext or simple hashing (MD5/SHA)?**
Bcrypt is adaptive (cost factor via salt rounds) and includes a random salt per password, so identical passwords produce different hashes and brute-force/dictionary attacks are slowed down. MD5/SHA are fast and unsalted → vulnerable to rainbow tables.

**Q2. What happens step-by-step at login?**
Find customer by normalized email → `bcrypt.compare(plaintext, hash)` → on match `jwt.sign({id}, JWT_SECRET, {expiresIn:'7d'})` → `res.cookie('token', jwt, {httpOnly...})` → return customer JSON without password.

**Q3. How does the auth middleware work?**
Reads `req.cookies.token` (cookie-parser) → `401` if missing → `jwt.verify(token, JWT_SECRET)` → `Customer.findById(decoded.id).select('-password')` → `401` if invalid/expired or customer gone → `req.user = customer; next()`.

**Q4. Why store JWT in an HttpOnly cookie instead of localStorage?**
`httpOnly` cookies are inaccessible to page JavaScript, so injected XSS scripts can't steal the token. localStorage is readable by any JS on the page.

**Q5. What do `secure` and `sameSite` do?**
`secure` restricts the cookie to HTTPS (production). `sameSite: 'strict'` stops the browser sending the cookie on cross-site requests, reducing CSRF risk.

**Q6. Why the same error for wrong email and wrong password?**
To prevent user enumeration — otherwise an attacker could probe which emails are registered.

**Q7. How are duplicate emails prevented?**
Two layers: application check (`findOne` → `409`) plus a MongoDB `unique` index (catches race conditions via error code `11000`, also mapped to `409`).

**Q8. What does `timestamps: true` do?**
Mongoose auto-manages `createdAt` and `updatedAt` on the schema (satisfies the `createdAt` requirement without manual code).

**Q9. Where is the password hashed, and how does change-password reuse it?**
In the model's `pre('save')` hook (only when `password` is modified). Register calls `Customer.create(...)` and change-password assigns `customer.password = newPassword` then `save()` — both trigger the same hook, so hashing logic lives in one place.

**Q10. How are errors kept consistent?**
Controllers validate input with `400/401/409` JSON responses and forward unexpected errors via `next(err)` to `error.middleware.js`, which returns `{ success: false, message }` with the right status (including Mongoose `ValidationError` → `400`).

## 10. Lab 03 — Product Catalog APIs

MVC additions: `models/product.model.js`, `controllers/product.controller.js`, `routes/product.routes.js` (mounted at `/products` in `index.js`).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/products` | Create product → `201` |
| GET | `/products` | List all; supports `?search=&category=&sort=price_asc\|price_desc` |
| GET | `/products/:id` | Single product; `400` invalid id, `404` not found |

- `search` = case-insensitive partial match on `name` (`$regex` + `i`).
- `category` = exact match; combine both for AND filtering.
- `sort=price_asc|price_desc` = bonus price sorting.
- Validation: `price > 0`, `stock >= 0`, `name/description/category/image` required → `400`.

Seed demo data: `npm run seed` (requires `MONGO_URI`). Frontend in `../frontend` (Vite, port 5173) uses these APIs; backend allows it via `cors({ origin: FRONTEND_URL, credentials: true })`.

## 11. Lab 04 — Wishlist

The wishlist lives **inside the Customer document** as an array of Product references. No second
User model, no duplicated product objects:

```js
wishlist: { type: [{ type: ObjectId, ref: 'Product' }], default: [] }
```

| Method | Endpoint | Auth | Success | Errors |
|---|---|---|---|---|
| POST | `/wishlist/:productId` | Yes | `200 { success, message, count }` | `400` invalid id, `404` product not found, `409` already in wishlist |
| GET | `/wishlist` | Yes | `200 { success, count, wishlist }` (products populated) | `401` |
| DELETE | `/wishlist/:productId` | Yes | `200 { success, message, count }` | `400`, `404` not in wishlist |
| PATCH | `/wishlist/:productId/toggle` | Yes | `200 { success, message, inWishlist, count }` | `400`, `404` (bonus) |

Security notes:

- The owner always comes from `req.user` (JWT). There is deliberately **no** `GET /wishlist/:userId`.
- `populate()` leaves a `null` hole when a product is deleted after being saved; the array is
  filtered so the client never has to null-check.

Frontend: `hooks/useWishlistAction.js` (add/remove + local state) and `lib/wishlistSync.js`
(read-through cache of saved ids + a pub/sub invalidation signal). That cache exists so N product
cards do not fire N `GET /wishlist` requests. It is **not** a store — mutations only invalidate it.

## 12. Lab 05 — Shopping Cart + global state

The cart is stored on the Customer document as references + quantity:

```js
cart: [{ product: { type: ObjectId, ref: 'Product', required: true }, quantity: { type: Number, default: 1, min: 1 } }]
```

| Method | Endpoint | Auth | Success | Errors |
|---|---|---|---|---|
| POST | `/cart/:productId` | Yes | `200 { success, message: 'Cart updated', cart }` | `400` invalid id / out of stock / `Only N units available`, `404` product not found |
| GET | `/cart` | Yes | `200 { success, count, cart }` | `401` |
| PATCH | `/cart/:productId` | Yes | `200 { success, message: 'Cart updated', cart }` | `400` whole number / at least 1 / `Only N units available for <name>`, `404` not in cart |
| DELETE | `/cart/:productId` | Yes | `200 { success, message: 'Product removed from cart', cart }` | `400`, `404` not in cart |

Stock rules: every write re-reads the **latest** `Product.stock`. `PATCH` rejects strings, floats,
booleans, objects, arrays and `null` with `Quantity must be a whole number` before any comparison,
so `"3"` can never slip through as a valid quantity.

Subtotal and total units are **never stored** — a persisted subtotal goes stale the moment a price
changes. They are derived on the client and recomputed on the server at checkout.

### One shared cart store

`frontend/src/context/CartContext.jsx` is the single source of truth. The Navbar badge, the Cart
page and every "Add to Cart" button read it; nothing fetches `/cart` on its own, so the badge can
never disagree with the page.

```
cartItems, loading, error, setError,
pendingIds, isPending(id),
refreshCart, addToCart, updateQuantity, removeFromCart, clearCart,
isInCart, quantityOf, subtotal, totalUnits
```

`totalUnits` is the sum of quantities, so `Keyboard x2 + Mouse x1` shows **Cart (3)**.

Because the cart lives in MongoDB, it survives a page refresh and a logout/login cycle. `clearCart()`
is called after a *verified* payment so the badge drops to Cart (0) with no page refresh.

## 13. Lab 06 — Checkout, Orders & Razorpay (test mode)

### Order model

`models/order.model.js` snapshots `name`, `price` and `image` per item next to the live `product`
reference. A Keyboard bought at 2999 still shows 2999 after the price changes to 999999 — an order
is a historical record, while a cart always resolves live data.

`status`: `PENDING_PAYMENT → PLACED → CONFIRMED → SHIPPED → DELIVERED`
`paymentStatus`: `PENDING → PAID | FAILED` (plus `failureReason` for diagnostics).

### Endpoints

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/orders/create-payment-order` | Yes | Body may contain **only** `shippingAddress` |
| POST | `/orders/verify-payment` | Yes | HMAC signature verification |
| GET | `/orders` | Yes | Own orders, newest first |
| GET | `/orders/:id` | Yes | `404` for anyone else's order |
| PATCH | `/orders/:id/status` | Yes | Bonus, dev only — `403` when `NODE_ENV=production` |

`POST /orders/create-payment-order` returns `200`:

```json
{
  "success": true,
  "message": "Payment order created",
  "shopKartOrderId": "…",
  "razorpayOrderId": "order_…",
  "amount": 629700,
  "currency": "INR",
  "totalAmount": 6297,
  "key": "rzp_test_…"
}
```

Order of operations: validate address → reload the cart from MongoDB → reload the LATEST products →
re-check stock → compute the total **on the server** → snapshot into an Order → create the Razorpay
order (amount in paise) → store `razorpayOrderId`. A `totalAmount`, `items` or `user` sent by the
browser is ignored, and the cart is **not** cleared. An existing `PENDING` / `PENDING_PAYMENT` order
is reused so a retry does not litter the orders history. The Razorpay call happens before the save,
so a Razorpay outage leaves no half-written order.

`POST /orders/verify-payment` is the only place the cart is emptied:

1. reject missing fields → `400 Missing payment verification details`
2. `Order.findOne({ _id, user: req.user._id })` — ownership is part of the query, so another user's
   order is simply not found (`404`), never confirmed
3. compare the stored `razorpayOrderId` with the request → `400 Payment does not match this order`
4. `HMAC-SHA256("${storedRazorpayOrderId}|${razorpay_payment_id}", RAZORPAY_KEY_SECRET)` compared
   with `crypto.timingSafeEqual` → `400 Invalid payment signature` (also records `failureReason`)
5. only then `paymentStatus = 'PAID'`, `status = 'PLACED'`, store the payment id, clear the cart

A `paymentSuccess: true` boolean from the browser is **never** trusted. Re-verifying an already-paid
order returns `200 Payment already verified` (idempotent, so a retry cannot double-clear the cart).

### CORS

`FRONTEND_URL` (comma-separated) sets the allowed origins; with no value the allow-list is
`http://localhost:5173`, `http://localhost:5199`, `http://localhost:3000`. `credentials: true` is
required for the cookie. Note: a request from a non-listed origin still reaches the server and still
returns `200` JSON — the browser just withholds the body from JS, so axios rejects with a bare
"Network Error" while DevTools shows a healthy request.

## 14. Environment variables

```
PORT=5000
MONGO_URI=…
JWT_SECRET=…
NODE_ENV=development
FRONTEND_URL=http://localhost:5173          # optional, comma-separated
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx           # Lab 06 - TEST mode
RAZORPAY_KEY_SECRET=…                        # Lab 06 - backend only, never sent to React
```

- Never hardcode `MONGO_URI`, `JWT_SECRET` or `RAZORPAY_KEY_SECRET`; never commit `.env`.
- `RAZORPAY_KEY_SECRET` is used for exactly two things: the Razorpay SDK and the HMAC signature.
  Only `RAZORPAY_KEY_ID` (which is public) reaches the browser.
- Use **Test Mode** keys from the Razorpay dashboard. With no keys configured, the rest of the API
  keeps working and only `POST /orders/create-payment-order` fails with a clear message.

## 15. Tests

```bash
npm run test:api
```

`tests/api.test.js` boots the real server on port 5051 and drives it over HTTP with a cookie jar,
covering Labs 01–06: registration/login/profile/logout, product search/filter/sort, wishlist
duplicates and isolation between customers, every invalid-quantity shape, stock ceilings, server-owned
pricing (forged `totalAmount`/items ignored), paise conversion, signature verification (forged,
mismatched, swapped ids), cart-clearing timing, order ownership and status progression. The outbound
Razorpay API call is stubbed through the test seam in `config/razorpay.js`, so the suite needs no live
credentials; the HMAC verification itself runs for real.
