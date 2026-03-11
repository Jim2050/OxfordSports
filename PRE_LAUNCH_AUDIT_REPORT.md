# Oxford Sports — Pre-Launch Audit Report

**Date:** 2026-03-11  
**Auditor:** Ali (Developer)  
**Commit:** d0348ba (deployed to Railway via ExtraFeature branch)

---

## Executive Summary

Comprehensive security, performance, data quality, and UX audit completed across **14 backend files**, **14 frontend files**, and **all live API endpoints**. **17 issues fixed**, **2 database cleanup operations executed**, and **all 2,311 products verified**.

---

## Issues Found & Fixed

### CRITICAL — Security (6 fixes)

| # | Issue | Risk | Fix Applied |
|---|-------|------|-------------|
| 1 | **NoSQL injection** via unsanitized `$regex` in productController (category, brand, search, color, subcategory params) | Remote code execution / data leak | Added `escapeRegex()` utility; all user input now escaped before use in `$regex` |
| 2 | **Email header injection** in contactController (name/email in From/Subject headers) | Spam relay / phishing | Added `sanitizeHeader()` (strips `\r\n\t`), `escapeHtml()` for body, email format validation, 5000-char message limit |
| 3 | **Admin auth bypass** — password-only login allowed (no email required) | Unauthorized admin access | Removed backward-compat code; both email + password now required |
| 4 | **Stock race condition** — order created before stock deduction; concurrent orders could oversell | Overselling inventory | Stock deducted BEFORE order creation with rollback on failure |
| 5 | **CSV formula injection** in order export (user-supplied fields like name, company, address) | Remote code execution via crafted values | Added `csvSafe()` wrapper that prefixes `=`, `+`, `-`, `@` with single quote |
| 6 | **Predictable upload filenames** — used `Date.now()-originalname` (guessable path) | File enumeration / overwrite | Replaced with `crypto.randomBytes(16).toString("hex")` in both uploadMiddleware and adminRoutes |

### HIGH — Performance & Data (5 fixes)

| # | Issue | Impact | Fix Applied |
|---|-------|--------|-------------|
| 7 | **N+1 query** in `getCategories` — one `countDocuments` per category (80+ queries) | Slow API response, DB load | Replaced with single `Product.aggregate()` `$group` pipeline |
| 8 | **Floating-point prices** — values like `17.64444444444445` stored and displayed | Confusing UI, incorrect billing | Added `toFixed(2)` in import controller; created `/api/admin/round-prices` endpoint; **2,067 prices fixed** in production |
| 9 | **80+ old category documents** — "Trainers", "Track pants", "T-shirts", etc. alongside FOOTWEAR/CLOTHING/ACCESSORIES | Broken category browsing | Ran `fix-subcategories` twice (**997 products recategorized**); ran `cleanup-categories` (**74 old Category docs removed**); now exactly **6 categories** |
| 10 | **Missing database indexes** — no index on Order.createdAt, customerEmail, customer+createdAt; no Product.createdAt index | Slow query performance | Added indexes on Order (customerEmail, createdAt, customer+createdAt compound) and Product (createdAt) |
| 11 | **Order number race condition** — `findOne` + parse sequence could generate duplicates | Duplicate order numbers | Replaced with `countDocuments` approach |

### MEDIUM — Configuration & Code Quality (4 fixes)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 12 | **Hardcoded admin password** in server.js (`"Godaddy1971turbs*"` as fallback) | Now env-only (`ADMIN_PASSWORD`); skips seed if not set |
| 13 | **CORS allows all origins** with credentials | Whitelist from `CLIENT_ORIGIN` env (comma-separated); falls back to `*` only if not configured |
| 14 | **Morgan always "dev" mode** in production | Now uses `"combined"` format in production for proper access logs |
| 15 | **Duplicate `module.exports`** in contactRoutes.js | Removed duplicate line |

### LOW — Frontend UX (2 fixes)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 16 | **No error boundary** — React crash = blank white screen | Added `ErrorBoundary` component wrapping entire app with user-friendly error UI + refresh button |
| 17 | **No Open Graph / Twitter meta tags** — poor social sharing when marketing | Added `og:title`, `og:description`, `og:type`, `og:url`, `twitter:card`, `twitter:title`, `twitter:description` to index.html |

---

## Database State After Cleanup

| Metric | Before | After |
|--------|--------|-------|
| Categories | 80+ (old names mixed with new) | **6** (FOOTWEAR, CLOTHING, ACCESSORIES, LICENSED TEAM CLOTHING, B GRADE, SPORTS) |
| Products with old categories | ~997 | **0** |
| Products with float prices | ~2,067 | **0** |
| FOOTWEAR products | 0 (were under "Trainers", etc.) | **878** |
| CLOTHING products | 0 (were under "Track pants", etc.) | **1,368** |
| ACCESSORIES products | 0 | **65** |
| Total products | 2,311 | **2,311** (all preserved) |
| Brands | 2 | **2** (adidas, adidas Originals) |

---

## New Admin Endpoints Added

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/round-prices` | Round all product prices to 2 decimal places (one-time fix) |
| `POST /api/admin/cleanup-categories` | Remove Category documents with 0 products (keeps FOOTWEAR/CLOTHING/ACCESSORIES/LICENSED TEAM CLOTHING/B GRADE/SPORTS) |

---

## Remaining Considerations (Non-Blocking)

These items are **not critical for launch** but worth noting for future work:

1. **Product images** — Most products have no images. Cloudinary is configured but images need to be uploaded via the admin panel or bulk upload feature.
2. **Colors** — 0 distinct colors in the database. The import data doesn't contain color info for most products.
3. **Only 2 brands** — Current stock is all adidas/adidas Originals. More brands will appear as new supplier files are uploaded.
4. **LICENSED TEAM CLOTHING, B GRADE, SPORTS** — Categories exist but have 0 products. They'll populate when relevant stock is imported.
5. **Code splitting** — Frontend loads all pages eagerly. React.lazy could improve initial load time but is not critical for a wholesale site with modest traffic.
6. **Refresh token** — JWT tokens last 7 days with no refresh mechanism. Acceptable for wholesale but could be improved.

---

## Verification Checklist

- [x] Backend health check: `ok`, 2311 products
- [x] Categories API: 6 clean categories with correct counts
- [x] Products API: Clean categories, subcategories, rounded prices
- [x] Brands API: 2 brands returned
- [x] Admin login: Requires email + password (no bypass)
- [x] Frontend: 200 OK, loads correctly
- [x] Error boundary: Wraps entire app
- [x] SEO meta tags: OG + Twitter cards present
- [x] All security fixes deployed and live

**Status: READY FOR MARKETING TRAFFIC**
