# OXFORD SPORTS — Complete Project Documentation

> **Last Updated:** March 6, 2026  
> **Client:** Jim (Oxford Sports UK)  
> **Project Type:** Wholesale B2B E-Commerce Platform  
> **Stack:** React 19 + Vite (Frontend) | Express 5 + MongoDB (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Deployment & URLs](#2-deployment--urls)
3. [Repository Structure](#3-repository-structure)
4. [Environment Variables](#4-environment-variables)
5. [Credentials & Authentication](#5-credentials--authentication)
6. [Backend Architecture](#6-backend-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Database Models](#8-database-models)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Dependencies](#10-dependencies)
11. [Development Setup](#11-development-setup)
12. [Current State & Known Issues](#12-current-state--known-issues)
13. [Deep Analysis & Modification Recommendations](#13-deep-analysis--modification-recommendations)

---

## 1. Project Overview

Oxford Sports is a **wholesale B2B sports apparel** platform replacing the legacy site at `https://www.oxfordsports.uk/`. The system allows:

- **Trade buyers (members)** to browse, search, and place bulk orders on sports products (Adidas, etc.)
- **Admin** to manage products via Excel imports, image uploads (ZIP), order management, and CSV exports
- Products are organized by **categories** (Rugby, Football, Footwear, etc.) with size-level stock tracking
- **No payment gateway** — orders are submitted as quote requests; invoicing is handled externally

### Key Business Requirements

| Feature | Status |
|---|---|
| Excel-driven product import (Adidas sheets) | ✅ Working |
| Image upload via ZIP | ⚠️ Needs verification |
| SKU grouping (multiple sizes → 1 listing) | ❌ Not yet implemented |
| Wholesale ordering (combined sizes per SKU) | ❌ Currently retail-style |
| Category structure from client sheet | ❌ Pending implementation |
| Admin dashboard | ✅ Working |
| Member registration & login | ✅ Working |
| Order placement & management | ✅ Working |
| Contact form (email) | ✅ Working (SMTP optional) |

---

## 2. Deployment & URLs

| Service | Platform | URL |
|---|---|---|
| **Backend API** | Railway | `https://jimpph-production.up.railway.app` |
| **Frontend** | Netlify | *(configured via Netlify dashboard)* |
| **Database** | MongoDB Atlas | *(connection string in `.env`)* |
| **Image CDN** | Cloudinary | *(optional — falls back to local `/uploads/`)* |

### Deployment Config Files

- `render.yaml` — Render blueprint (alternative deployment)
- `Frontend/.env.production` — Points frontend API to Railway backend
- `Frontend/public/_redirects` — Netlify SPA redirect rules

---

## 3. Repository Structure

```
OxfordSports/
├── .gitignore
├── render.yaml                     # Render deployment config
│
├── Backend/                        # Express.js API server
│   ├── server.js                   # Entry point — app setup, middleware, routes, admin seed
│   ├── package.json                # Backend dependencies
│   ├── .env.example                # Environment variable template (empty)
│   │
│   ├── config/
│   │   ├── db.js                   # MongoDB connection (mongoose)
│   │   └── cloudinary.js           # Cloudinary SDK configuration
│   │
│   ├── controllers/
│   │   ├── adminController.js      # Admin login, product CRUD, categories, stats, export
│   │   ├── authController.js       # Member register, login, profile
│   │   ├── contactController.js    # Contact form → email (nodemailer)
│   │   ├── importController.js     # Excel import, ZIP image upload, image resolve, price fix
│   │   ├── orderController.js      # Place order, my orders, admin orders, export orders
│   │   └── productController.js    # Public product listing, search, filters, SKU lookup
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT verify (protect) + admin role check (adminOnly)
│   │   ├── errorMiddleware.js      # 404 handler + global error handler
│   │   └── uploadMiddleware.js     # Multer config for Excel (.xlsx) and ZIP/image uploads
│   │
│   ├── models/
│   │   ├── User.js                 # User schema (member/admin, bcrypt hashing)
│   │   ├── Product.js              # Product schema (sizes array, price, stock, text index)
│   │   ├── Order.js                # Order schema (items, auto-generated order numbers)
│   │   ├── Category.js             # Category schema (name, slug, image, displayOrder)
│   │   ├── Subcategory.js          # Subcategory schema (linked to Category)
│   │   └── ImportBatch.js          # Import tracking (rows imported/failed, error log)
│   │
│   ├── routes/
│   │   ├── adminRoutes.js          # /api/admin/* — all admin endpoints
│   │   ├── authRoutes.js           # /api/auth/* — register, login, me
│   │   ├── contactRoutes.js        # /api/contact — contact form
│   │   ├── orderRoutes.js          # /api/orders/* — place/view orders (member)
│   │   └── productRoutes.js        # /api/products/* — public product browsing
│   │
│   ├── utils/
│   │   ├── generateToken.js        # JWT token generation (7-day expiry)
│   │   ├── imageResolver.js        # Image URL resolution utilities
│   │   └── importUtils.js          # Excel parsing helpers
│   │
│   └── uploads/                    # Local file storage (gitignored)
│       └── temp/                   # Temporary upload directory
│
├── Frontend/                       # React 19 + Vite SPA
│   ├── package.json                # Frontend dependencies
│   ├── vite.config.js              # Vite config (proxy /api → localhost:5000)
│   ├── index.html                  # HTML entry point
│   ├── .env.production             # Production API URL
│   ├── .env.production.template    # Template for env setup
│   │
│   ├── public/
│   │   └── _redirects              # Netlify SPA redirects
│   │
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── App.jsx                 # Router + Layout + Route definitions
│       ├── index.css               # Global styles
│       │
│       ├── api/
│       │   ├── axiosInstance.js     # Axios config, JWT decode, auto-logout interceptor
│       │   └── api.js              # All API call functions + image/price helpers
│       │
│       ├── context/
│       │   ├── AuthContext.jsx      # Member auth state (login/register/logout)
│       │   └── CartContext.jsx      # Shopping cart state (localStorage persistence)
│       │
│       ├── components/
│       │   ├── ProtectedRoute.jsx   # Route guard (requires member login)
│       │   ├── layout/
│       │   │   ├── Header.jsx       # Top navigation bar
│       │   │   └── Footer.jsx       # Site footer
│       │   ├── cart/
│       │   │   └── CartDrawer.jsx   # Slide-out cart panel
│       │   ├── products/
│       │   │   ├── ProductCard.jsx  # Single product display card
│       │   │   ├── ProductGrid.jsx  # Grid layout for products
│       │   │   └── SearchBar.jsx    # Product search component
│       │   └── categories/
│       │       └── CategoryTile.jsx # Category display tile
│       │
│       └── pages/
│           ├── admin/
│           │   ├── AdminPage.jsx    # Admin dashboard (products, orders, import/export)
│           │   └── AdminLogin.jsx   # Admin login form
│           └── public/
│               ├── HomePage.jsx         # Landing page
│               ├── CategoryPage.jsx     # Category product listing
│               ├── AllProductsPage.jsx  # All products with filters
│               ├── ProductPage.jsx      # Single product detail
│               ├── UnderFivePage.jsx    # Products under £5
│               ├── ContactPage.jsx      # Contact form
│               └── RegisterPage.jsx     # Member registration
```

---

## 4. Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | **Yes** | — | MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | — | Secret key for JWT signing |
| `PORT` | No | `5000` | Server port |
| `CLIENT_ORIGIN` | No | `*` (all origins) | Frontend URL for CORS (e.g., Netlify URL) |
| `ADMIN_EMAIL` | No | `admin@oxfordsports.net` | Default admin account email |
| `ADMIN_PASSWORD` | No | `Godaddy1971turbs*` | Default admin account password |
| `CLOUDINARY_CLOUD_NAME` | No | — | Cloudinary cloud name (images stored locally if not set) |
| `CLOUDINARY_API_KEY` | No | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | — | Cloudinary API secret |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server for contact emails |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username (contact form logged to console if not set) |
| `SMTP_PASS` | No | — | SMTP password |
| `CONTACT_EMAIL_TO` | No | `sales@oxfordsports.net` | Recipient for contact form emails |
| `NODE_ENV` | No | — | Set to `production` in deployed environments |

### Frontend (`Frontend/.env.production`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | Backend API base URL (e.g., `https://jimpph-production.up.railway.app/api`) |
| `VITE_BACKEND_URL` | No | Backend origin for resolving relative image paths |

### Current Production Values

```dotenv
# Frontend/.env.production
VITE_API_BASE_URL=https://jimpph-production.up.railway.app/api
```

---

## 5. Credentials & Authentication

### Admin Access

| Field | Value |
|---|---|
| **Email** | `admin@oxfordsports.net` |
| **Password** | `Godaddy1971turbs*` |
| **Login URL** | `/admin` (frontend) or `POST /api/admin/login` (API) |
| **Token Storage** | `sessionStorage` → key: `adminToken` |
| **Token Expiry** | 7 days (JWT) |

> The admin user is **auto-seeded** on server startup if no admin exists in the database. Credentials come from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars with the above defaults.

### Member (Trade Buyer) Access

| Field | Details |
|---|---|
| **Registration** | `/register` page or `POST /api/auth/register` |
| **Login** | Header login modal or `POST /api/auth/login` |
| **Role** | `member` (auto-assigned) |
| **Token Storage** | `localStorage` → key: `memberToken` |
| **Token Expiry** | 7 days (JWT) |
| **Password Requirements** | Minimum 6 characters |
| **Auto-approved** | Yes (`isApproved: true` by default) |

### Authentication Flow

1. User submits email + password
2. Server validates credentials, returns JWT token
3. Frontend stores token in `localStorage` (member) or `sessionStorage` (admin)
4. Axios interceptor attaches `Authorization: Bearer <token>` to requests
5. On 401 response, interceptor auto-removes token and dispatches logout event
6. `protect` middleware on backend verifies JWT and attaches `req.user`
7. `adminOnly` middleware checks `req.user.role === "admin"`

### Password Hashing

- Algorithm: **bcrypt** (via `bcryptjs`)
- Salt rounds: **10**
- Passwords are hashed via a Mongoose `pre('save')` hook
- `select: false` on password field — never included in queries by default

---

## 6. Backend Architecture

### Tech Stack

| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | — |
| Framework | Express.js | 5.2.1 |
| Database | MongoDB (via Mongoose) | 9.2.2 |
| Auth | JWT (jsonwebtoken) | 9.0.3 |
| Password Hashing | bcryptjs | 3.0.3 |
| File Upload | Multer | 2.0.2 |
| Excel Parsing | xlsx (SheetJS) | 0.18.5 |
| Image CDN | Cloudinary SDK | 2.9.0 |
| Email | Nodemailer | 8.0.1 |
| Security | Helmet + CORS + Rate Limiting | — |
| ZIP Processing | adm-zip | 0.5.16 |

### Middleware Stack (in order)

1. **Helmet** — Security headers (cross-origin resource policy: `cross-origin`)
2. **CORS** — Origin from `CLIENT_ORIGIN` env var, credentials enabled
3. **Morgan** — HTTP request logging (`dev` format)
4. **Body Parser** — JSON (10MB limit) + URL-encoded
5. **Rate Limiter** — 200 requests/min per IP on `/api` routes
6. **Extended Timeout** — 5 minutes for import/upload routes
7. **Static Files** — `/uploads` directory served statically
8. **404 Handler** — Catches unmatched routes
9. **Error Handler** — Mongoose validation, duplicate key, Multer errors

### Server Startup Sequence

1. Load `.env` variables
2. Validate required env vars (`MONGO_URI`, `JWT_SECRET`)
3. Connect to MongoDB Atlas
4. Seed default admin user (if none exists)
5. Start HTTP server on `PORT`

---

## 7. Frontend Architecture

### Tech Stack

| Component | Technology | Version |
|---|---|---|
| Framework | React | 19.2.4 |
| Build Tool | Vite | 7.3.1 |
| Routing | React Router DOM | 7.13.1 |
| HTTP Client | Axios | 1.13.5 |
| Notifications | React Hot Toast | 2.6.0 |
| File Upload UI | React Dropzone | 15.0.0 |

### State Management

- **AuthContext** — Member authentication state (token, user, login/register/logout)
- **CartContext** — Shopping cart (localStorage persistence, add/remove/update/clear)
- No Redux or Zustand — context-only state management

### Route Map

| Path | Component | Auth Required | Description |
|---|---|---|---|
| `/` | `HomePage` | No | Landing page |
| `/contact` | `ContactPage` | No | Contact form |
| `/register` | `RegisterPage` | No | Member sign-up |
| `/admin` | `AdminPage` | Admin JWT | Admin dashboard |
| `/rugby-category` | `CategoryPage` | Member | Rugby products |
| `/football` | `CategoryPage` | Member | Football products |
| `/footwear` | `CategoryPage` | Member | Footwear products |
| `/under-5` | `UnderFivePage` | Member | Products under £5 |
| `/products` | `AllProductsPage` | Member | Full product catalog |
| `/product/:sku` | `ProductPage` | Member | Single product detail |
| `/:slug` | `CategoryPage` | Member | Dynamic category page |

### Dev Server Proxy

Vite proxies `/api` requests to `http://localhost:5000` during development, eliminating CORS issues locally.

---

## 8. Database Models

### User Model

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required, trimmed |
| `email` | String | Required, unique, lowercase |
| `password` | String | Required, min 6 chars, `select: false` |
| `company` | String | Optional |
| `role` | Enum | `member` or `admin` |
| `isApproved` | Boolean | Default: `true` |
| `createdAt` | Date | Auto (timestamps) |
| `updatedAt` | Date | Auto (timestamps) |

### Product Model

| Field | Type | Notes |
|---|---|---|
| `sku` | String | Required, unique, uppercase, indexed |
| `name` | String | Required |
| `description` | String | Default: `""` |
| `category` | String | Indexed |
| `subcategory` | String | — |
| `brand` | String | Indexed |
| `color` | String | — |
| `barcode` | String | — |
| `salePrice` | Number | Required, min 0, indexed |
| `rrp` | Number | Default: 0 |
| `sizes` | Array | `[{size: String, quantity: Number}]` |
| `totalQuantity` | Number | Auto-computed from sizes on save |
| `imageUrl` | String | Cloudinary URL or local path |
| `imagePublicId` | String | Cloudinary public ID |
| `sheetName` | String | Source Excel sheet name |
| `isActive` | Boolean | Default: `true`, indexed |

**Indexes:**
- Text index: `name`(10), `sku`(8), `brand`(5), `color`(3), `description`(2)
- Compound: `category + subcategory`
- Single: `sku`, `brand`, `salePrice`, `isActive`, `category`

**Computed fields (on JSON serialization):**
- `image` → alias for `imageUrl`
- `price` → alias for `salePrice`
- `quantity` / `stockQuantity` → alias for `totalQuantity`
- `discountPercentage` → computed from `rrp` and `salePrice`
- `sizeStock` → map of `{size: quantity}` from sizes array

### Order Model

| Field | Type | Notes |
|---|---|---|
| `orderNumber` | String | Auto-generated: `OS-YYYYMMDD-XXXX` |
| `customer` | ObjectId → User | Required |
| `customerName` | String | Required |
| `customerEmail` | String | Required |
| `customerCompany` | String | — |
| `items` | Array | `[{product, sku, name, size, quantity, unitPrice, lineTotal}]` |
| `totalAmount` | Number | Required |
| `status` | Enum | `pending → confirmed → processing → shipped → completed → cancelled` |
| `notes` | String | Optional buyer notes |

### Category Model

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required, unique |
| `slug` | String | Required, unique, lowercase |
| `description` | String | — |
| `imageUrl` | String | — |
| `displayOrder` | Number | For sorting |
| `isActive` | Boolean | Default: `true` |

### Subcategory Model

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `slug` | String | Required, lowercase |
| `category` | ObjectId → Category | Required |
| `description` | String | — |
| `imageUrl` | String | — |
| `isActive` | Boolean | Default: `true` |

**Unique constraint:** `category + slug` (same subcategory name OK in different categories)

### ImportBatch Model

| Field | Type | Notes |
|---|---|---|
| `filename` | String | Required |
| `importedBy` | ObjectId → User | Admin who ran the import |
| `totalRows` | Number | — |
| `importedRows` | Number | — |
| `updatedRows` | Number | — |
| `failedRows` | Number | — |
| `errorLog` | Array | `[{row, sku, reason}]` |
| `status` | Enum | `pending → processing → complete → failed` |

---

## 9. API Endpoints Reference

### Public Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API info + available endpoints |
| `GET` | `/api/health` | Health check (DB status + product count) |

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | — | Register a new member |
| `POST` | `/login` | — | Member login → JWT |
| `GET` | `/me` | Member | Get current user profile |

### Products (`/api/products`) — Public (browsing)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | List products (search, filter, paginate) |
| `GET` | `/brands` | — | Get all distinct brands |
| `GET` | `/categories` | — | Get all distinct categories |
| `GET` | `/colors` | — | Get all distinct colors |
| `GET` | `/:sku` | — | Get single product by SKU |

### Orders (`/api/orders`) — Member Protected

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/` | Member | Place a new order |
| `GET` | `/mine` | Member | Get own order history |

### Contact (`/api/contact`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/` | — | Submit contact form |

### Admin (`/api/admin`) — Admin Protected (except login)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Admin login (email+password or password-only) |
| `GET` | `/stats` | Dashboard statistics |
| `POST` | `/products` | Add a single product |
| `PUT` | `/products/:sku` | Update product by SKU |
| `DELETE` | `/products/:sku` | Delete product by SKU |
| `DELETE` | `/products` | Delete ALL products |
| `GET` | `/categories` | Get categories list |
| `POST` | `/import-products` | Import products from Excel file |
| `POST` | `/upload-images` | Upload product images (ZIP) |
| `GET` | `/import-batches` | Get import history |
| `GET` | `/export` | Export all products |
| `GET` | `/orders` | Get all orders (admin view) |
| `PUT` | `/orders/:id/status` | Update order status |
| `GET` | `/export-orders` | Export orders as CSV |
| `POST` | `/fix-subcategories` | Migration utility |
| `POST` | `/fix-brands` | Migration utility |
| `POST` | `/fix-prices` | Migration utility |
| `POST` | `/resolve-images` | Resolve product image URLs |

---

## 10. Dependencies

### Backend (`Backend/package.json`)

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.2.1 | Web framework |
| `mongoose` | ^9.2.2 | MongoDB ODM |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `jsonwebtoken` | ^9.0.3 | JWT auth tokens |
| `cors` | ^2.8.6 | Cross-origin requests |
| `helmet` | ^8.1.0 | Security headers |
| `express-rate-limit` | ^8.2.1 | Rate limiting |
| `express-async-handler` | ^1.2.0 | Async error wrapping |
| `dotenv` | ^17.3.1 | Environment variables |
| `multer` | ^2.0.2 | File upload handling |
| `xlsx` | ^0.18.5 | Excel file parsing |
| `cloudinary` | ^2.9.0 | Image CDN uploads |
| `nodemailer` | ^8.0.1 | Email sending |
| `adm-zip` | ^0.5.16 | ZIP file extraction |
| `morgan` | ^1.10.1 | HTTP request logging |

### Frontend (`Frontend/package.json`)

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | React DOM renderer |
| `react-router-dom` | ^7.13.1 | Client-side routing |
| `axios` | ^1.13.5 | HTTP client |
| `react-hot-toast` | ^2.6.0 | Toast notifications |
| `react-dropzone` | ^15.0.0 | Drag-and-drop file upload |

**Dev Dependencies:**
| Package | Version | Purpose |
|---|---|---|
| `vite` | ^7.3.1 | Build tool / dev server |
| `@vitejs/plugin-react` | ^5.1.4 | React HMR plugin |

---

## 11. Development Setup

### Prerequisites

- **Node.js** (v18+ recommended)
- **MongoDB Atlas** account (or local MongoDB)
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd OxfordSports

# 2. Backend setup
cd Backend
npm install
# Create .env file with required variables:
# MONGO_URI=mongodb+srv://...
# JWT_SECRET=your_secret_key
npm run dev          # Starts on http://localhost:5000

# 3. Frontend setup (new terminal)
cd Frontend
npm install
npm run dev          # Starts on http://localhost:5173 (proxies /api → :5000)
```

### Build for Production

```bash
# Frontend
cd Frontend
npm run build        # Output → Frontend/dist/

# Backend
cd Backend
npm start            # No build step — runs server.js directly
```

---

## 12. Current State & Known Issues

### Working Features ✅

- Full admin dashboard (login, product CRUD, stats)
- Excel product import (`.xlsx`, `.xls`, `.csv` — up to 50MB)
- Member registration and login with JWT auth
- Product browsing with search, category/brand/color filters
- Shopping cart with size-level stock validation
- Order placement with auto-generated order numbers (`OS-YYYYMMDD-XXXX`)
- Admin order management (view, update status, CSV export)
- Contact form (logs to console without SMTP; sends email with SMTP)
- Rate limiting (200 req/min per IP)
- Security headers via Helmet
- Auto-admin seeding on first startup

### Known Issues & Gaps ⚠️

| Issue | Severity | Details |
|---|---|---|
| **Retail-style ordering** | **Critical** | Products display individually per size/row from Excel. Client needs wholesale grouping: one listing per SKU with all sizes combined |
| **Image upload via ZIP** | High | Client reports "nothing happens" when uploading images through ZIP. Needs investigation |
| **Category structure** | High | Current categories don't match client's required structure (15 highlighted categories from `WEBSITE_CATEGORIES_YASIR.xlsx`) |
| **No CMS** | Medium | React-based — no traditional backend for client self-editing. Client needs to be informed about this limitation |
| **Hardcoded admin credentials** | Medium | Default password visible in `server.js` and `render.yaml` |
| **Empty `.env.example`** | Low | Template file exists but has no content — developers won't know which vars to set |
| **No input validation library** | Low | Validation done manually in each controller |
| **No automated tests** | Low | Multiple test files exist but are one-off scripts, not a test suite |

---

## 13. Deep Analysis & Modification Recommendations

### A. Critical Architecture Issues

#### 1. SKU Grouping (Highest Priority — Client Requirement)

**Current:** Each row in the Excel creates a separate `Product` document. If Adidas sends 10 sizes of the same shoe, 10 products appear in the store.

**Required:** Group all sizes under a single SKU listing. Customer sees 1 product card with a size/quantity selector grid.

**Implementation Plan:**
- The `Product` model already supports `sizes: [{size, quantity}]` — the data model is ready
- The import controller needs to **merge** rows with the same SKU instead of creating separate products
- Frontend `ProductCard` and `ProductPage` need a size-quantity grid (not dropdowns)
- Cart logic needs to support multiple size selections per product in a single add-to-cart action

#### 2. Category System Overhaul

**Current:** Categories are stored as plain strings on products. A `Category` and `Subcategory` model exist but aren't fully utilized.

**Required:** 15 top-level categories from client's sheet, with gender sub-categories (Men's, Women's, Kids).

**Implementation Plan:**
- Populate `Category` collection from client's Excel sheet
- Add gender-based subcategories (Men's, Women's, Kids) under each
- Update import controller to auto-categorize products based on SKU patterns (e.g., `FFR` → Rugby/France)
- Update frontend navigation to show proper category hierarchy

#### 3. Wholesale Ordering Flow

**Current:** Retail-style — user selects 1 size, 1 quantity, adds to cart per size.

**Required:** Wholesale grid — user enters quantities for multiple sizes simultaneously, minimum order quantities apply.

**Implementation Plan:**
- Create a size/quantity grid component (similar to `oxfordsports.uk`)
- Implement MOQ rules (e.g., footwear = 24 units, t-shirts = 100 per listing)
- Cart should show grouped items per SKU with sub-items per size
- Consider a pro-rata calculator showing average quantity per size

### B. Security Improvements

| Item | Risk | Recommendation |
|---|---|---|
| Admin password in source code | High | Move to env-only; remove from `server.js` defaults and `render.yaml` |
| No HTTPS enforcement | Medium | Add `express-sslify` or trust Railway/Netlify HTTPS |
| Rate limit too generous | Low | 200/min is high; consider separate limits per route type |
| No CSRF protection | Low | Not critical for JWT-based API, but consider for cookie-based sessions |
| JWT secret rotation | Low | No mechanism to rotate secrets without invalidating all tokens |

### C. Code Quality & Maintainability

| Area | Current State | Recommendation |
|---|---|---|
| **Validation** | Manual `if` checks in every controller | Use `joi`, `zod`, or `express-validator` for schema validation |
| **Error handling** | `try/catch` in every controller | Use `express-async-handler` (already installed but not used everywhere) |
| **Testing** | 15+ test/diagnostic scripts (one-off) | Set up `jest` + `supertest` for proper test suite |
| **Logging** | `console.log/error` only | Consider `winston` or `pino` for structured logging |
| **API documentation** | None | Add Swagger/OpenAPI spec |
| **TypeScript** | Not used | Consider for type safety (major refactor) |
| **Linting** | No ESLint config | Add ESLint + Prettier |

### D. Performance Considerations

| Area | Current | Improvement |
|---|---|---|
| **Product queries** | Good text index exists | Add Redis caching for frequently accessed categories/brands |
| **Image optimization** | Cloudinary handles this when configured | Implement responsive images (`srcset`) on frontend |
| **Bundle size** | No analysis | Add `rollup-plugin-visualizer` to identify large deps |
| **Pagination** | Implemented in product controller | Ensure all list endpoints are paginated |
| **Import performance** | Extended timeout (5 min) | Consider background job queue (Bull/BullMQ) for large imports |

### E. Feature Roadmap (from Client Conversations)

| Priority | Feature | Estimated Effort |
|---|---|---|
| **P0** | SKU grouping — combine sizes into single listing | 2-3 days |
| **P0** | Category structure from client's Excel sheet | 1-2 days |
| **P0** | Fix image ZIP upload | 0.5-1 day |
| **P1** | Wholesale ordering grid (multi-size, multi-qty) | 2-3 days |
| **P1** | MOQ rules (minimum order quantities) | 1 day |
| **P1** | Pro-rata calculator | 0.5 day |
| **P2** | Sign-up form: add delivery address + mobile | 0.5 day |
| **P2** | Homepage redesign: background image, clean categories | 1 day |
| **P2** | Sub-categories by gender | 1 day |
| **P2** | Auto-categorize by SKU pattern | 1-2 days |
| **P3** | Daily stock comparison / auto "Sold Out" sync | 2-3 days |
| **P3** | Adidas reorder Excel generation | 1-2 days |
| **P3** | Invoice2go integration | 2-3 days |
| **P3** | Monthly retainer / maintenance plan setup | — |

### F. File Cleanup Recommendations

The following files appear to be **one-off scripts** and can be moved to a `scripts/` directory or removed:

```
Backend/add-demo-images.js
Backend/check-excel.js
Backend/check-product.js
Backend/clean-test-products.js
Backend/clean-test.js
Backend/comprehensive-validation.js
Backend/create-client-real-products.js
Backend/create-client-template.js
Backend/create-sample-template.js
Backend/diagnose.js
Backend/display-client-products.js
Backend/fast-fix.js
Backend/FINAL-TEST.js
Backend/fix-database.js
Backend/fix-real-prices.js
Backend/migrate-schema.js
Backend/test-*.js (7 files)
Backend/ultra-fast-price-fix.js
Backend/upload-folder-images.js
Backend/validate-*.js (2 files)
Backend/verify-production.js
```

The root-level documentation files should also be consolidated:
```
BLUEPRINT.md, CLIENT_PRODUCTS_VALIDATION.md, COMPLETE_DEPLOYMENT_GUIDE.md,
CRITICAL_FIX_RAILWAY.md, DEPLOYMENT_READY.md, DEPLOYMENT_STATUS.md,
DEPLOYMENT.md, DOCKER_DEPLOYMENT.md, FINAL_DELIVERY.md, IMAGE_UPLOAD_GUIDE.md,
LOCAL_VALIDATION_REPORT.md, NIXPACKS_DEPLOYMENT.md, PRODUCT_IMPORT_TEMPLATE_GUIDE.md,
PRODUCTION_VALIDATION.md, RAILWAY_DEPLOYMENT_GUIDE.md, START_HERE.md
```

**Recommendation:** Archive/remove all the above docs and keep a single `README.md` + this `PROJECT_DOCUMENTATION.md`.

---

*End of Documentation*
