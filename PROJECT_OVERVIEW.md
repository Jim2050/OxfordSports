# Oxford Sports Architecture & Codebase Analysis (AI Context)

This document is specifically structured as a reference for AI coding agents to rapidly ingest the architecture, schemas, API constraints, and file paths necessary for refactoring, extending, or maintaining the Oxford Sports codebase.

## 1. System Context & Tech Stack
*   **Application Type**: B2B Wholesale / B2C E-commerce SPA.
*   **Frontend Environment**: React 19, Vite, React Router v7. State is exclusively handled via React Context API (no Redux).
*   **Backend Environment**: Node.js, Express v5.
*   **Data Persistence**: MongoDB Atlas via Mongoose v9.2.2.
*   **Image Handling**: Cloudinary (primary) -> Local File System (fallback).
*   **Email Handling**: Resend API (HTTP primary to bypass firewalls) -> Nodemailer (SMTP Gmail/Outlook).

---

## 2. Live URLs & Project Resources
*   **GitHub Repository**: [github.com/Jim2050/OxfordSports](https://github.com/Jim2050/OxfordSports)
*   **Live Website (Frontend)**: [https://www.oxfordsports.online/](https://www.oxfordsports.online/)
*   **Admin Dashboard**: [https://www.oxfordsports.online/admin](https://www.oxfordsports.online/admin)
*   **Railway Hosting Console**: [Railway Project Deployment](https://railway.com/project/08bf6103-893b-4834-a35f-8fc92bc1e179?)

---

## 3. Absolute File Map (Critical Paths)
The project resides at: `c:\Users\Zs Technology\Desktop\Jim Client\OxfordSports\`

### Backend (`Backend/`)
*   `Backend/server.js`: Entry point, CORS config, Trust Proxy, Rate Limiter (200req/min).
*   `Backend/config/db.js`: MongoDB connect.
*   `Backend/models/User.js`: User schema.
*   `Backend/models/Product.js`: Product schema and taxonomy indexing.
*   `Backend/models/Order.js`: Order schema.
*   `Backend/controllers/authController.js`: Registration, login, profile fetches.
*   `Backend/controllers/productController.js`: Read-only queries for the frontend.
*   `Backend/controllers/orderController.js`: Order checkout, stock allocation, and email triggering.
*   `Backend/controllers/adminController.js`: Full CRUD admin operations.
*   `Backend/controllers/importController.js`: Excel spreadsheet and zip file ingestion.
*   `Backend/utils/emailService.js`: Nodemailer configuration and failover logic.
*   `Backend/utils/emailQueue.js`: In-memory asynchronous queue preventing request blocking.
*   `Backend/utils/taxonomyUtils.js`: Normalization of categories/subcategories.

### Frontend (`Frontend/`)
*   `Frontend/src/main.jsx`: React render root.
*   `Frontend/src/App.jsx`: Global Layout and React Router DOM definitions.
*   `Frontend/src/api/api.js`: All exported data-fetching helper functions (mapping to endpoints).
*   `Frontend/src/api/axiosInstance.js`: Axios configuration and token interceptors.
*   `Frontend/src/context/AuthContext.jsx`: User state and token persistence.
*   `Frontend/src/context/CartContext.jsx`: Shopping cart data store.
*   `Frontend/src/pages/public/`: Public-facing React views (Login, Home).
*   `Frontend/src/pages/admin/`: Gated admin dashboard views.

---

## 4. Database Schemas (Mongoose)
*Current Database: MongoDB Atlas (Cluster: cluster0.puflo.mongodb.net/Oxford)*

### 4.1 `Product` (`Backend/models/Product.js`)
*   `sku` (String, Required, Unique, Uppercase, Trimmed)
*   `name` (String, Required)
*   `description` (String, Default: `""`)
*   `category`, `subcategory`, `brand` (String, plus `*Canonical` computed equivalents)
*   `salePrice` (Number, Required, min: 0)
*   `rrp` (Number, Default: 0)
*   `sizes`: Array of sub-documents `[{ size: String, quantity: Number }]`
*   `totalQuantity`: (Number) *Computed pre-save by summing `sizes.quantity`.*
*   `imageUrl`, `imagePublicId` (String, for Cloudinary)
*   `isActive` (Boolean, Default: `true`)
*   **Virtuals**: `image`, `stockQuantity`, `price` (mapped to `salePrice`), `discountPercentage`.
*   **Indexes**: Text index on `name`, `description`, `brand`, `sku`, `color` with weighting.

### 4.2 `User` (`Backend/models/User.js`)
*   `name` (String, Required)
*   `email` (String, Required, Unique, Lowercase)
*   `password` (String, Required, min: 6, `select: false`)
*   `company`, `mobileNumber`, `deliveryAddress` (String)
*   `role` (String, Enum: `["member", "admin"]`, Default: `"member"`)
*   `isApproved` (Boolean, Default: `true`)
*   **Middleware**: Pre-save hashes password via `bcrypt`.

### 4.3 `Order` (`Backend/models/Order.js`)
*   `orderNumber` (String, Unique) *Computed pre-save (OS-YYYYMMDD-XXXX)*
*   `customer` (ObjectId, ref: `User`)
*   `customerName`, `customerEmail`, `customerCompany`, `customerPhone`, `deliveryAddress` (Snapshot Strings)
*   `items`: Array of sub-documents:
    *   `product` (ObjectId), `sku` (String), `name` (String), `size` (String)
    *   `quantity` (Number), `unitPrice` (Number), `lineTotal` (Number)
    *   `lotItem` (Boolean), `maxStock` (Number), `lotSizeBreakdown` (String)
*   `totalAmount` (Number, Required)
*   `status` (String, Enum: `["pending", "confirmed", "processing", "shipped", "completed", "cancelled"]`)
*   `emailSent` (Boolean), `emailError` (String)

---

## 5. API Endpoint Index

### Auth & Public (`/api/auth`, `/api/contact`)
*   `POST /api/auth/register`: `{ name, email, password, company, mobileNumber, deliveryAddress }`
*   `POST /api/auth/login`: `{ email, password }` -> Returns `{ success, token, user }`
*   `GET /api/auth/me`: Requires JWT. Returns `{ user }`.
*   `POST /api/contact`: Form submission.

### Products (`/api/products`) - Read Only
*   `GET /`: Fetches products (query filters: `category`, `maxPrice`, search text).
*   `GET /brands`, `/categories`, `/subcategories`, `/colors`: Distinct field retrievals (with 5 min cache).
*   `GET /:sku`: Fetch single product by SKU.

### Orders (`/api/orders`) - Protected
*   `POST /`: Payload: `{ items: [{ sku, size, quantity }], notes }`. Submits order.
*   `GET /mine`: Fetches history for `req.user`.

### Admin (`/api/admin`) - Protected (Admin Role)
*   `POST /login`: Admin authentication.
*   `GET /stats`: Dashboard counts.
*   `GET /products`, `POST /products`, `PUT /products/:sku`, `DELETE /products/:sku`: Product CRUD.
*   `POST /products/:sku/upload-image`: Mutler image upload (10MB limit).
*   `POST /import-products`: Excel parsing via `multer`.
*   `POST /upload-images`: Zip file image batch via `multer`.

---

## 6. Frontend State Management & Hooks

### `AuthContext` (`Frontend/src/context/AuthContext.jsx`)
*   **State**: `user` (Object|null), `token` (String|null), `loading` (Boolean), `isAuthenticated` (Boolean).
*   **Functions**: `login(email, password)`, `register(...)`, `logout()`.
*   **Side Effects**: Automatically attaches `Bearer ${token}` to `axiosInstance` upon state change. Clears token on `401` HTTP response.
*   **Feature Flag**: If `AUTH_PUBLIC_MODE` is true, returns a static guest object and skips real auth.

### `CartContext` (`Frontend/src/context/CartContext.jsx`)
*   **State**: `items` (Array of cart objects), `drawerOpen` (Boolean).
*   **Persistence**: Synced to `localStorage` under `oxfordSportsCart`.
*   **Key generation**: Items are tracked by `${sku}::${size}`.
*   **Cart Item Schema**: `{ sku, name, size, quantity, price, rrp, imageUrl, maxStock, lotItem, minOrderQty, quantityLocked }`
*   **Functions**: `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`.

---

## 7. Core Business Logic, Constraints & Admin Flows

### 7.1 Order Deduplication & Concurrency
*   **Fingerprinting**: In `Backend/controllers/orderController.js`, `buildOrderFingerprint(userId, items, notes)` creates a SHA-1 hash of the payload. Stored in a Node `Set` to block duplicate `POST` attempts while processing.
*   **Stock Atomicity**: Stock deductions use Mongoose `Product.bulkWrite()` with `$inc` targeting the specific size array index. Checks `{ "sizes.quantity": { $gte: takeQty } }` to prevent race conditions. If one fails, previously successful bulk writes in the loop are rolled back manually.

### 7.2 Minimum Order Quantity (MOQ) Logic
*   **Frontend**: Handled by `getMOQInfo(product)` in `Frontend/src/api/api.js`.
    *   **Footwear / General**: If `totalQty <= 24`, the user is forced to buy *all* remaining stock (`mustBuyAll = true`, `quantityLocked = true`).
    *   **Lot Categories** ("JOB LOTS", "UNDER £5"): Represent wholesale indivisible lots. Cannot customize quantity, forced to buy the total amount.
*   **Backend**: `orderController.js` validates these constraints. If an item is a Footwear/Lot under threshold, it will auto-populate missing sizes into the `orderItems` payload to enforce the "buy all" rule.
*   **Order Minimum**: `MIN_ORDER_TOTAL` is £300. Evaluated against `ENFORCE_MIN_ORDER_TOTAL` env variable (true/false).

### 7.3 Email Dispatch Architecture
*   Orders do not hang on email sending. `getEmailQueue().add()` pushes the task out of the request lifecycle.
*   **Primary Send**: Direct HTTP `POST` to `https://api.resend.com/emails` bypassing any Railway server outbound SMTP port blocks.
*   **Fallback Send**: Nodemailer using `SMTP_HOST` (Outlook/O365), failing over to Gmail (`smtp.gmail.com`).

### 7.4 Admin Flows & Operations
*   **Authentication**: Admin routes are protected by `protect` and `adminOnly` middleware requiring JWT with `role: "admin"`.
*   **Batch Operations**:
    *   Excel imports (`POST /api/admin/import-products`) process thousands of rows via `xlsx` and map to the `Product` model.
    *   Zip Image uploads (`POST /api/admin/upload-images`) extract images and match filenames to SKUs.
*   **State / UI**: The Admin Dashboard (`Frontend/src/pages/admin/AdminPage.jsx`) handles all CRUD natively via Context and API hooks without Redux.

---

## 8. Deployment & Environment Configuration (Railway)

The application is deployed via **Railway** (`nixpacks.toml` and `.railwayignore` exist in the backend). Express `trust proxy` is enabled to read correct IPs behind the cloud load balancer.

### 8.1 Backend Container / Process Variables (`oxford-sports`)
*   `PORT`: `5000`
*   `NODE_ENV`: `development`
*   `MONGO_URI`: `mongodb+srv://bhuttokashifali1957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford`
*   `JWT_SECRET`: `Oxford-sports-jwt-secret-2026`
*   `CLOUDINARY_API_KEY`: `836744593982542`
*   `CLOUDINARY_API_SECRET`: `SipPXEurF3Gn4dL3tCUMlUbJz9Q`
*   `CLOUDINARY_CLOUD_NAME`: `ddx15rbsq`
*   `CONTACT_EMAIL_TO`: `sales@oxfordsports.net`
*   `DISABLE_AUTH`: *(Hidden in console)*
*   `RESEND_API_KEY`: *(Hidden in console)*
*   `RESEND_FROM_EMAIL`: *(Hidden in console)*

### 8.2 Frontend Container Variables (`OxfordSports`)
*   `SMTP_HOST`: `smtp.gmail.com`
*   `SMTP_PORT`: `587`
*   `VITE_API_BASE_URL`: `https://oxford-sports.up.railway.app/api`
*   `VITE_BACKEND_URL`: `https://oxford-sports.up.railway.app/api`
*   `VITE_ORDER_EMAIL`: `uksportswarehouse@googlemail.com`
