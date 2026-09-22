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
