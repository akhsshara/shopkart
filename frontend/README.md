# ShopKart Frontend — Labs 02 & 03 (React + Vite)

Auth UI + Product Discovery. Talks to Lab 01/03 backend at `http://localhost:5000`.

## Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Backend must be running (`cd backend; npm run dev`) with `FRONTEND_URL=http://localhost:5173` for cookies/CORS.

## Routes

| Route | Page | API |
|---|---|---|
| `/register` | Register (controlled fields, validation, → login) | `POST /customers/register` |
| `/login` | Login (`withCredentials`, → `/home`) | `POST /customers/login` |
| `/home` | Protected (fetches profile, redirects to login if 401) | `GET /customers/me` |
| `/products` | Listing + search/filter/sort, loading/error/empty states | `GET /products?search=&category=&sort=` |
| `/products/:id` | Details + Add to Cart (UI only) | `GET /products/:id` |

Logout button in navbar → `POST /customers/logout` → `/login`.

## Notes for viva

- `withCredentials: true` lets the browser send/receive the HttpOnly `token` cookie cross-origin.
- JS can't read HttpOnly cookies (XSS protection); the browser attaches them automatically.
- `/home` is protected because it verifies `GET /customers/me` instead of trusting local state.
- `search`/`category` are query params (filtering); `:id` is a URL param (single resource).
- Backend does search/filter/sort so large datasets never load fully into React.
