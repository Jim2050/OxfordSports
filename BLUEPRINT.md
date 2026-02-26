# Oxford Sports – Technical Architecture Blueprint

**Prepared:** February 26, 2026  
**Purpose:** Architectural plan to rebuild a functionally equivalent wholesale sportswear website, replacing the unstable Sintra AI platform  
**Scope:** Analysis only – no code produced

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Current Site Structure Analysis](#3-current-site-structure-analysis)
4. [UI Component Breakdown](#4-ui-component-breakdown)
5. [Reusable UI Components](#5-reusable-ui-components)
6. [Data Architecture](#6-data-architecture)
7. [Excel Import System Design](#7-excel-import-system-design)
8. [Image Handling Strategy](#8-image-handling-strategy)
9. [Email Order System Logic](#9-email-order-system-logic)
10. [Recommended Tech Stack](#10-recommended-tech-stack)
11. [Deployment Strategy](#11-deployment-strategy)
12. [Domain Configuration Plan](#12-domain-configuration-plan)
13. [Risks & Considerations](#13-risks--considerations)
14. [Automation Opportunities](#14-automation-opportunities)
15. [Scaling Concerns](#15-scaling-concerns)

---

## 1. Project Overview

Oxford Sports is a **wholesale branded sportswear clearance business** trading at `oxfordsports.uk`. The business sells end-of-season clearance stock (adidas football kits, rugby kits, footwear) to trade buyers at wholesale prices.

### Current Pain Points

| Issue                           | Root Cause                                       |
| ------------------------------- | ------------------------------------------------ |
| Site crashes for days at a time | Hosted on Sintra AI (third-party, unstable SaaS) |
| Manual image uploads required   | No automated image-to-product mapping            |
| No reliable bulk listing tool   | Sintra has no robust Excel import pipeline       |
| No control over uptime          | Fully dependent on Sintra's platform stability   |

### Goal

Replace Sintra with an **owned, self-hosted or controlled platform** that:

- Mirrors the current site's look and structure
- Allows bulk product uploads from Excel with images
- Generates email order links per product
- Requires zero payment gateway
- Is fully owned and maintainable by the client

---

## 2. Functional Requirements

### 2.1 Must-Have (MVP)

- **FR-01** — Public homepage with brand hero section, tagline, and category navigation
- **FR-02** — 2-tier category hierarchy: Category → Subcategory → Products
- **FR-03** — Product listing pages with image, name, description, price, and "Order via Email" link
- **FR-04** — Member registration and login gate (products visible to registered members only)
- **FR-05** — Email order link per product (pre-populated `mailto:` with product details)
- **FR-06** — Contact page with business details and contact form
- **FR-07** — Secure admin panel for product management (add, edit, delete, bulk import)
- **FR-08** — Bulk Excel (.xlsx) upload via admin panel
- **FR-09** — Image upload and association to products (manual and/or automated)
- **FR-10** — Footer with Quick Links, contact info, copyright

### 2.2 Should-Have

- **FR-11** — Image filename auto-mapping to products based on SKU/product code in Excel
- **FR-12** — Product search/filter by category, brand, price range
- **FR-13** — "Under £5" dynamic collection driven by price field
- **FR-14** — CSV/Excel export of current product list for admin review
- **FR-15** — Admin dashboard showing total products, categories, recent uploads

### 2.3 Nice-to-Have

- **FR-16** — Email notification to admin when a customer submits a contact form
- **FR-17** — Bulk image upload via ZIP archive (images auto-matched to SKUs)
- **FR-18** — Preview mode before publishing uploaded products
- **FR-19** — Simple analytics dashboard (page views per product, most-viewed categories)

---

## 3. Current Site Structure Analysis

### 3.1 Page Map

```
/ (Home)
├── /rugby-category           ← Category landing
│   ├── /all-blacks           ← Subcategory product list (members only)
│   └── /france-rugby         ← Subcategory product list (members only)
├── /football                 ← Category landing
│   ├── /real-madrid          ← Subcategory product list (members only)
│   ├── /arsenal              ← Subcategory product list (members only)
│   ├── /bayern               ← Subcategory product list (members only)
│   └── /juventus             ← Subcategory product list (members only)
├── /footwear                 ← Category landing
│   ├── /adizero              ← Subcategory (members only)
│   └── /padel-shoes          ← Subcategory (members only)
├── /under-5                  ← Dynamic price-filtered collection (members only)
├── /register                 ← Member registration
├── /contact                  ← Contact page with form + business info
└── /[login]                  ← Member login (inferred)
```

### 3.2 Member Access Gate

- All **product listing pages** are behind a registration/login wall
- Unauthenticated users see a "Members Only – Register Now" prompt
- This means product data is **non-indexed publicly**, protecting wholesale pricing

### 3.3 Observed Page Patterns

| Page Type                    | Description                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Homepage**                 | Hero banner, tagline "Branded Sportswear Wholesale", intro text, category tiles (4), CTA to register |
| **Category Landing**         | Title, subtitle, grid of subcategory tiles (image + name + short description + "View Products" link) |
| **Subcategory Product List** | Members-only gate OR grid of product cards                                                           |
| **Contact**                  | Two-column layout: contact info left, contact form right                                             |
| **Register/Login**           | Standard auth forms                                                                                  |
| **Footer**                   | Three columns: Quick Links (full nav tree), Contact details, Legal                                   |

---

## 4. UI Component Breakdown

### 4.1 Global / Layout Components

| Component       | Description                                                               |
| --------------- | ------------------------------------------------------------------------- |
| `<SiteHeader>`  | Logo (left), site name/tagline (centre), Register/Sign In link (right)    |
| `<SiteNav>`     | Horizontal nav bar with expandable items for categories and subcategories |
| `<SiteFooter>`  | Three-column footer: Quick Links tree, Contact block, Copyright line      |
| `<PageWrapper>` | Consistent max-width container, padding, background                       |

### 4.2 Homepage Components

| Component            | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `<HeroBanner>`       | Full-width image/background, large heading, subheading, optional CTA button |
| `<IntroText>`        | Short paragraph block describing the site purpose ("No more spreadsheets…") |
| `<CategoryTileGrid>` | 2×2 or 4-across responsive grid of category tiles                           |
| `<CategoryTile>`     | Image + title + "View Products" link                                        |
| `<RegisterCTA>`      | Prominent call-to-action block linking to /register                         |

### 4.3 Category & Subcategory Pages

| Component           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `<PageHero>`        | Page title + subtitle banner (smaller than homepage hero) |
| `<SubcategoryGrid>` | Grid of subcategory cards                                 |
| `<SubcategoryCard>` | Image + title + short description + "View Products" link  |

### 4.4 Product Listing Page

| Component            | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `<MembersOnlyGate>`  | Conditional wrapper: shows product grid if authenticated, else shows registration prompt |
| `<ProductGrid>`      | Responsive grid (2–4 columns) of product cards                                           |
| `<ProductCard>`      | Product image, name, description (abbreviated), price, "Order" button                    |
| `<OrderEmailButton>` | `mailto:` anchor pre-filled with product name, SKU, and price                            |
| `<PriceTag>`         | Styled price display (supports "Under £5" highlighting)                                  |

### 4.5 Contact Page

| Component            | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `<ContactInfoBlock>` | Phone, email, address, business hours, delivery info |
| `<ContactForm>`      | Name, Email, Message fields + Submit button          |
| `<DeliveryInfo>`     | Flat rate delivery pricing display                   |

### 4.6 Auth Pages

| Component        | Description                                         |
| ---------------- | --------------------------------------------------- |
| `<RegisterForm>` | Name, email, password, optional company name fields |
| `<LoginForm>`    | Email + password + forgot password link             |
| `<AuthCard>`     | Centred card wrapper for auth forms                 |

### 4.7 Admin Panel Components

| Component            | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `<AdminLayout>`      | Sidebar navigation + main content area                                                   |
| `<AdminDashboard>`   | Stats tiles: product count, category count, last upload date                             |
| `<ProductTable>`     | Sortable, filterable table of all products with edit/delete actions                      |
| `<ProductForm>`      | Single-product add/edit form                                                             |
| `<ExcelImportPanel>` | File drop zone for .xlsx upload, column mapping UI, preview table, confirm import button |
| `<ImageUploadPanel>` | Bulk image upload zone, image-to-SKU mapping status                                      |
| `<CategoryManager>`  | CRUD interface for categories and subcategories                                          |

---

## 5. Reusable UI Components

These components are shared across multiple page types and should be built as isolated, generic units:

| Component                                             | Used In                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `<Button>` (variants: primary, secondary, outline)    | Throughout                                       |
| `<Card>` (generic container with optional image slot) | Category tiles, subcategory cards, product cards |
| `<Grid>` (responsive CSS grid wrapper)                | All grid layouts                                 |
| `<Badge>`                                             | Price tags, "New", "Under £5" labels             |
| `<Modal>`                                             | Confirm dialogs in admin                         |
| `<Notification / Toast>`                              | Import success/failure messages                  |
| `<Spinner / LoadingState>`                            | Excel import processing, image upload            |
| `<FormField>` (label + input + error)                 | All forms                                        |
| `<Pagination>`                                        | Product lists with many items                    |
| `<SectionHeader>` (title + subtitle)                  | All page headings                                |
| `<EmptyState>`                                        | Empty product lists, no results                  |
| `<ProtectedRoute>`                                    | Auth gate wrapper for members-only pages         |

---

## 6. Data Architecture

### 6.1 Entities & Relationships

```
User (Member)
  ├── id, email, password_hash, name, company, approved(bool), created_at

Category
  ├── id, name, slug, description, image_url, sort_order

Subcategory
  ├── id, category_id (FK), name, slug, description, image_url, sort_order

Product
  ├── id
  ├── subcategory_id (FK)
  ├── sku                    ← Key field for image mapping
  ├── name
  ├── description
  ├── price (decimal)
  ├── currency (default: GBP)
  ├── sizes_available        ← JSON array or comma-separated
  ├── quantity_available
  ├── brand                  ← e.g., "adidas"
  ├── image_url              ← Path or CDN URL
  ├── is_active (bool)
  ├── created_at
  ├── updated_at

ImportBatch
  ├── id, filename, imported_by, imported_at, status, row_count, error_log
```

### 6.2 Expected Excel Column Schema

Based on typical wholesale sportswear stock sheets, the expected import columns are:

| Excel Column               | Maps To                      | Required |
| -------------------------- | ---------------------------- | -------- |
| SKU / Product Code         | `product.sku`                | Yes      |
| Product Name               | `product.name`               | Yes      |
| Description                | `product.description`        | No       |
| Category                   | `category.name`              | Yes      |
| Subcategory / Club / Brand | `subcategory.name`           | No       |
| Price (£)                  | `product.price`              | Yes      |
| Sizes                      | `product.sizes_available`    | No       |
| Quantity                   | `product.quantity_available` | No       |
| Image Filename             | `product.image_url` (mapped) | No       |

### 6.3 Dynamic Collections

- **"Under £5"** is not a true category — it is a **database query filter** (`WHERE price <= 5.00 AND is_active = true`) rendered as a virtual category page
- This means no manual maintenance is needed — it auto-updates as products are added/edited

---

## 7. Excel Import System Design

### 7.1 Import Workflow (Step by Step)

```
1. Admin uploads .xlsx file via drag-and-drop panel in admin UI
2. Server parses the file using a spreadsheet library (e.g., SheetJS / xlsx)
3. System reads column headers from row 1
4. Column mapping UI is displayed (auto-maps known headers, allows manual override)
5. Preview table shows first 10 rows with mapped field labels
6. Admin reviews and confirms import
7. System validates each row:
   - Required fields present (SKU, Name, Price, Category)
   - Price is a valid number
   - Category exists or is created on-the-fly
8. Valid rows are inserted/upserted into the products table (SKU as unique key)
9. Existing SKUs are UPDATED (not duplicated)
10. Import summary shown: X rows imported, Y rows updated, Z rows failed
11. Failed rows downloadable as error report (.xlsx)
```

### 7.2 Upsert Logic (Idempotent Imports)

- SKU is the **unique identifier** for upsert operations
- Re-uploading the same Excel sheet will update existing records, not create duplicates
- This makes it safe to re-run full stock sheets without data corruption

### 7.3 Category Auto-Creation

- If an imported row references a category not yet in the database, the system can:
  - **Option A:** Auto-create the category with a warning flag for admin review
  - **Option B:** Reject that row and flag it in the error report
- Recommended: **Option A** with admin review queue

### 7.4 Import Validation Rules

| Rule               | Behaviour on Failure               |
| ------------------ | ---------------------------------- |
| SKU missing        | Skip row, log error                |
| Price not numeric  | Skip row, log error                |
| Name missing       | Skip row, log error                |
| Category not found | Auto-create OR skip (configurable) |
| Duplicate SKU      | Update existing record (upsert)    |
| Price < 0          | Skip row, log error                |

---

## 8. Image Handling Strategy

### 8.1 Current Problem

The client manually uploads images one by one. This is slow, error-prone, and entirely dependent on Sintra's uploader working.

### 8.2 Recommended Strategy: SKU-Based Filename Matching

The most reliable and lowest-friction solution:

```
Convention: image filename must match the product SKU

Example:
  Product SKU:       ADI-RM-HOME-24-M
  Image filename:    ADI-RM-HOME-24-M.jpg  (or .png / .webp)
```

This allows **bulk image upload + auto-matching** with no manual linking.

### 8.3 Image Upload Workflow

```
1. Admin uploads a ZIP archive containing all product images
2. Server extracts the archive to a temporary staging directory
3. System iterates each image file:
   a. Strip file extension to extract filename stem (= expected SKU)
   b. Query database for matching SKU
   c. If match found: update product.image_url with the new file path
   d. If no match found: flag as "unmatched image" for manual review
4. Admin is shown:
   - X images matched and linked
   - Y images unmatched (listed with filenames)
5. Images are moved to permanent storage (local or cloud CDN)
```

### 8.4 Storage Options

| Option                     | Pros                                       | Cons                              |
| -------------------------- | ------------------------------------------ | --------------------------------- |
| **Cloudinary (free tier)** | Auto-resize, CDN delivery, free up to 25GB | Third-party dependency            |
| **AWS S3 + CloudFront**    | Full control, reliable, scalable           | Requires AWS account, minor cost  |
| **Vercel Blob Storage**    | Native to Vercel, easy setup               | Newer product, less battle-tested |
| **Local server storage**   | Simplest, no cost                          | No CDN, not scalable              |

**Recommended:** Cloudinary free tier for images. It handles resizing, WebP conversion, and CDN delivery automatically. Fallback to local storage if full ownership is preferred.

### 8.5 Image Naming Convention Document

A simple one-page guide should be provided to the client explaining:

- How to name image files (must match SKU exactly)
- Supported formats: `.jpg`, `.png`, `.webp`
- Max file size recommendation: 2MB per image
- How to prepare a ZIP archive for bulk upload

---

## 9. Email Order System Logic

### 9.1 How It Works

Each product card contains an **"Order This Item"** button that generates a `mailto:` link. When clicked, it opens the user's default email client with a pre-filled message. No checkout, no payment.

### 9.2 Mailto Link Structure

The link encodes the following into the email:

**To:** `sales@oxfordsports.net`  
**Subject:** `Order Enquiry – [Product Name]`  
**Body:**

```
Hi Oxford Sports,

I would like to place an order for the following item:

Product:      [Product Name]
SKU:          [SKU]
Price:        £[Price]
Category:     [Category / Subcategory]

My details:
Name:         [Pre-filled from member profile]
Company:      [Pre-filled from member profile]
Email:        [Pre-filled from member profile]

Please send me an invoice.

Thank you
```

### 9.3 Design Decisions

- The `mailto:` body is **URL-encoded** so it works across all email clients
- Member name, company, and email are pre-filled from the session (they are logged in already)
- The customer does not need to fill in a form — one click opens a ready-to-send email
- No server-side processing required for the order itself
- Admin receives orders directly in their email inbox as before

### 9.4 Optional Enhancement: Order Enquiry Form

As an alternative or supplement to `mailto:`, a lightweight in-page order form can:

1. Capture: product details (auto-filled) + customer message + submit
2. Send via a transactional email service (Resend, SendGrid, or Nodemailer)
3. Deliver a formatted order email to `sales@oxfordsports.net`
4. Show customer a confirmation message

This removes reliance on the customer's email client being configured correctly.

---

## 10. Recommended Tech Stack

### 10.1 Decision Summary

| Layer             | Recommendation                                   | Justification                                                                     |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Framework**     | Next.js 14 (App Router)                          | SSR + SSG hybrid, SEO-friendly, API routes built-in, React ecosystem              |
| **Language**      | TypeScript                                       | Type safety critical for data models and Excel import parsing                     |
| **Styling**       | Tailwind CSS                                     | Utility-first, fast to build, easy to maintain, no CSS files                      |
| **UI Components** | shadcn/ui                                        | Accessible, unstyled components built on Radix UI, integrates with Tailwind       |
| **Database**      | PostgreSQL (via Supabase)                        | Relational, reliable, supports complex queries, free hosted tier                  |
| **ORM**           | Prisma                                           | Type-safe DB access, auto-generates migration files, works perfectly with Next.js |
| **Auth**          | NextAuth.js (Auth.js v5)                         | Built for Next.js, supports credentials + email, session management               |
| **Excel Parsing** | SheetJS (xlsx library)                           | Industry standard, handles .xls and .xlsx, runs server-side                       |
| **Image Storage** | Cloudinary                                       | CDN, resizing, free tier, simple upload API                                       |
| **Email (Order)** | `mailto:` link (primary) + Resend API (optional) | `mailto:` requires no infrastructure; Resend for form-based fallback              |
| **Admin UI**      | Custom Next.js admin routes (under `/admin`)     | Full control, no third-party admin panel needed                                   |
| **Deployment**    | Vercel                                           | Zero-config Next.js deployment, global CDN, instant preview deployments           |

### 10.2 Why Next.js Over Alternatives

| Option                  | Verdict        | Reason                                                                 |
| ----------------------- | -------------- | ---------------------------------------------------------------------- |
| **Next.js 14**          | ✅ Recommended | Full-stack in one framework: pages, API, auth, SSR, SSG                |
| Plain React (CRA/Vite)  | ❌ Avoid       | No built-in API routes, requires separate backend, more infrastructure |
| Plain HTML/CSS          | ❌ Avoid       | No dynamic data, no auth, no admin panel possible                      |
| WordPress + WooCommerce | ⚠️ Not ideal   | Overkill, requires payment plugin disabled, harder to bulk import      |
| Webflow                 | ⚠️ Not ideal   | No custom backend, limited Excel import capability                     |

### 10.3 Why Supabase Over Alternatives

| Option                    | Verdict        | Reason                                                                  |
| ------------------------- | -------------- | ----------------------------------------------------------------------- |
| **Supabase (PostgreSQL)** | ✅ Recommended | Free tier generously sized, GUI dashboard, real-time capable, SQL-based |
| MongoDB                   | ⚠️ Possible    | Document DB less suited to relational product/category hierarchy        |
| SQLite                    | ⚠️ Dev-only    | Not suitable for production multi-user access                           |
| MySQL (PlanetScale)       | ✅ Alternative | Good option if Supabase not preferred                                   |
| Firebase                  | ⚠️ Possible    | NoSQL, good auth, but less natural for structured product data          |

---

## 11. Deployment Strategy

### 11.1 Recommended: Vercel + Supabase

```
Architecture:

Browser → Vercel Edge CDN
               ↓
          Next.js App (Vercel)
          ├── Public pages  (SSG / ISR – fast, cached)
          ├── Member pages  (SSR – authenticated, dynamic)
          ├── Admin routes  (SSR – admin-only)
          └── API routes    (/api/*)
               ↓
          Supabase (PostgreSQL)
               +
          Cloudinary (Images)
```

### 11.2 Vercel Configuration

| Setting               | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| Build Command         | `next build`                                              |
| Output Directory      | `.next`                                                   |
| Node Version          | 20.x                                                      |
| Environment Variables | `DATABASE_URL`, `NEXTAUTH_SECRET`, `CLOUDINARY_URL`, etc. |
| Preview Deployments   | Enabled – each Git push creates a preview URL for review  |

### 11.3 Deployment Environments

| Environment     | Purpose           | URL Pattern              |
| --------------- | ----------------- | ------------------------ |
| **Production**  | Live site         | `oxfordsports.uk`        |
| **Preview**     | Per-branch review | `branch-name.vercel.app` |
| **Development** | Local machine     | `localhost:3000`         |

### 11.4 CI/CD Pipeline

```
Developer pushes to Git (GitHub/GitLab)
         ↓
Vercel detects push
         ↓
Automatic build + lint check
         ↓
Preview deployment generated (non-main branches)
         ↓
Merge to main → automatic production deployment
         ↓
Zero downtime deploy (Vercel handles routing)
```

### 11.5 Database Management

- Supabase hosts PostgreSQL — no server management required
- Prisma handles schema migrations via `prisma migrate deploy`
- Migrations run as part of the deployment pipeline before the app starts
- Connection pooling via Supabase's built-in PgBouncer

---

## 12. Domain Configuration Plan

### 12.1 Current Domain: `oxfordsports.uk`

The domain is presumably managed at a registrar (e.g., 123-reg, GoDaddy, Namecheap).

### 12.2 DNS Cutover Steps

```
1. Log into domain registrar DNS management panel
2. Add Vercel's DNS records (provided during Vercel domain setup):
   - Type: A     Name: @    Value: 76.76.21.21  (Vercel IP)
   - Type: CNAME Name: www  Value: cname.vercel-dns.com
3. In Vercel dashboard:
   - Go to Project → Settings → Domains
   - Add oxfordsports.uk and www.oxfordsports.uk
   - Vercel auto-provisions a free SSL/TLS certificate (Let's Encrypt)
4. DNS propagation: 15 minutes to 24 hours
5. Test: visit https://oxfordsports.uk — should show new site
6. Decommission Sintra only after successful DNS verification
```

### 12.3 SSL / HTTPS

- Vercel automatically provisions and renews SSL certificates via Let's Encrypt
- No manual certificate management required
- HTTPS enforced by default (HTTP redirects to HTTPS)

### 12.4 Email: `sales@oxfordsports.net`

- The contact/order email uses `oxfordsports.net` (different TLD to the website)
- This email does not need to change — it is a standalone inbox
- If transactional emails are added (e.g., contact form notifications), set up:
  - MX records for the sending domain
  - SPF, DKIM, DMARC records to prevent emails landing in spam

---

## 13. Risks & Considerations

### 13.1 Data Migration Risk

| Risk                                       | Mitigation                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Products lost during migration from Sintra | Export all product data from Sintra before cutover; use as first Excel import       |
| Images not available for download          | Screenshot or request image export from Sintra; re-upload during setup              |
| Member list lost                           | Export member emails from Sintra; re-invite or trigger password reset on new system |

### 13.2 Member Authentication Risk

| Risk                                   | Mitigation                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Existing members can't log in          | New system requires re-registration or admin-imported accounts                   |
| Sintra stores passwords (not portable) | Passwords cannot be migrated (hashed); send re-registration email to all members |

### 13.3 SEO Risk

| Risk                                        | Mitigation                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| URL structure changes break Google rankings | Mirror existing URL slugs exactly (e.g., `/rugby-category`, `/all-blacks`) |
| 301 redirects needed if URLs change         | Configure redirects in `next.config.js`                                    |
| Product pages gated (not indexed)           | This is intentional (wholesale pricing protection) — no SEO impact         |

### 13.4 Excel Import Risk

| Risk                                            | Mitigation                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Client uses different column headers each time  | Build flexible column-mapping UI, save mapping profiles per upload   |
| Mixed data types in Excel (e.g., price as text) | Sanitise and coerce all values during parsing                        |
| Merged cells in Excel                           | Warn admin if merged cells detected; flatten before import           |
| Macros or complex Excel formulas                | Parse cell values only (not formulas); use SheetJS `cellValues` mode |

### 13.5 Image Risk

| Risk                             | Mitigation                                                          |
| -------------------------------- | ------------------------------------------------------------------- |
| Image filenames don't match SKUs | Provide naming convention guide; show unmatched images in admin     |
| Very large images slow the site  | Auto-resize and convert to WebP via Cloudinary                      |
| Cloudinary free tier exceeded    | Monitor usage; upgrade to free-next-tier or migrate to S3 if needed |

### 13.6 Operational Risk

| Risk                                               | Mitigation                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Admin forgets to mark products active after import | Default new products to active; add toggle in admin                                    |
| Sintra still crashes during transition period      | Run both sites in parallel during handover; cutover DNS only when new site is verified |

---

## 14. Automation Opportunities

| Opportunity                                 | Priority | Effort |
| ------------------------------------------- | -------- | ------ |
| SKU-based image filename auto-matching      | High     | Low    |
| ZIP bulk image upload + auto-link           | High     | Medium |
| Upsert on re-upload (no duplicates)         | High     | Low    |
| "Under £5" auto-populates from price field  | High     | Low    |
| Auto-create categories from Excel import    | Medium   | Low    |
| Email notification to admin on contact form | Medium   | Low    |
| Member pre-fill in `mailto:` order link     | Medium   | Low    |
| Import error report download (Excel)        | Medium   | Medium |
| Scheduled stock export / backup             | Low      | Medium |
| Webhook: notify admin when stock falls low  | Low      | High   |

---

## 15. Scaling Concerns

The current business model is **wholesale B2B** — meaning a small, known customer base. Volume expectations are modest. The architecture described is **intentionally lightweight** and will handle this comfortably. However, note the following future considerations:

| Concern                  | Current Impact                               | Future Consideration                                           |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------- |
| Product catalogue growth | Currently small (dozens to hundreds of SKUs) | PostgreSQL handles 100k+ rows without issue                    |
| Image storage growth     | Low                                          | Cloudinary free tier = 25GB; upgrade path is straightforward   |
| Concurrent user load     | Very low (wholesale trade buyers)            | Vercel's CDN handles spikes; no concern at this scale          |
| Admin import frequency   | Weekly or monthly uploads                    | No concurrency issues at this frequency                        |
| Database connections     | Low                                          | Supabase free tier allows 60 connections; more than sufficient |

**Conclusion:** The proposed stack is appropriate for the current scale and has clear, low-friction upgrade paths if the business grows significantly.

---

## Appendix A: Folder Structure (Conceptual)

```
/
├── app/                          ← Next.js App Router
│   ├── (public)/                 ← Public-facing routes
│   │   ├── page.tsx              ← Homepage
│   │   ├── [category]/page.tsx   ← Category landing
│   │   ├── [category]/[sub]/     ← Subcategory product list
│   │   ├── contact/page.tsx
│   │   └── under-5/page.tsx      ← Dynamic price-filtered page
│   ├── (auth)/                   ← Auth routes
│   │   ├── register/page.tsx
│   │   └── login/page.tsx
│   ├── admin/                    ← Admin panel (protected)
│   │   ├── dashboard/page.tsx
│   │   ├── products/page.tsx
│   │   ├── import/page.tsx       ← Excel import panel
│   │   ├── images/page.tsx       ← Image upload panel
│   │   └── categories/page.tsx
│   └── api/                      ← API routes
│       ├── import/route.ts       ← Excel upload handler
│       ├── images/route.ts       ← Image upload handler
│       ├── products/route.ts
│       └── auth/[...nextauth]/
├── components/                   ← Reusable UI components
│   ├── ui/                       ← Generic (Button, Card, Grid…)
│   ├── layout/                   ← Header, Footer, Nav
│   ├── products/                 ← ProductCard, ProductGrid, OrderButton
│   └── admin/                    ← ImportPanel, ProductTable, ImageUpload
├── lib/                          ← Utilities
│   ├── db.ts                     ← Prisma client
│   ├── excel.ts                  ← SheetJS parse logic
│   ├── cloudinary.ts             ← Image upload helpers
│   └── email.ts                  ← Mailto builder / Resend helper
├── prisma/
│   └── schema.prisma             ← Database schema
└── public/
    └── uploads/                  ← Local image fallback (dev only)
```

---

## Appendix B: Key Third-Party Services Summary

| Service     | Purpose                        | Cost                 | URL              |
| ----------- | ------------------------------ | -------------------- | ---------------- |
| Vercel      | Hosting + deployment           | Free tier (Hobby)    | vercel.com       |
| Supabase    | PostgreSQL database            | Free tier (500MB)    | supabase.com     |
| Cloudinary  | Image CDN + storage            | Free tier (25GB)     | cloudinary.com   |
| Resend      | Transactional email (optional) | Free tier (3,000/mo) | resend.com       |
| GitHub      | Version control + CI trigger   | Free                 | github.com       |
| NextAuth.js | Authentication                 | Open source          | next-auth.js.org |

**Total infrastructure cost at launch: £0/month** (all free tiers are adequate for this scale)

---

_Blueprint produced for Oxford Sports website rebuild project. February 26, 2026._

---

---

# Part II – MERN Stack Architecture

**Revised:** February 26, 2026
**Stack:** MongoDB · Express.js · React · Node.js
**Replaces:** Next.js / Supabase / Prisma stack from Part I
**Deployment Target:** Render (Backend) + Netlify (Frontend)

---

## Table of Contents – MERN Section

1. [Backend Folder Structure](#m1-backend-folder-structure)
2. [Frontend Folder Structure](#m2-frontend-folder-structure)
3. [MongoDB Schema Models](#m3-mongodb-schema-models)
4. [REST API Endpoints](#m4-rest-api-endpoints)
5. [JWT Authentication Flow](#m5-jwt-authentication-flow)
6. [Protected Route Strategy](#m6-protected-route-strategy)
7. [Excel Import API Workflow](#m7-excel-import-api-workflow)
8. [Image Upload API Workflow](#m8-image-upload-api-workflow)
9. [Deployment Architecture](#m9-deployment-architecture-netlify--render)
10. [Environment Variables](#m10-environment-variables)

---

## M1. Backend Folder Structure

The backend lives in the `Backend/` folder at the repository root. It is a standalone Node.js + Express application.

```
Backend/
├── config/
│   ├── db.js                  ← MongoDB connection setup via Mongoose
│   └── cloudinary.js          ← Cloudinary SDK configuration
│
├── controllers/
│   ├── authController.js      ← register, login, getMe
│   ├── productController.js   ← CRUD + bulk import handler
│   ├── categoryController.js  ← CRUD for categories and subcategories
│   ├── imageController.js     ← Single and bulk (ZIP) image upload
│   └── contactController.js   ← Contact form → email dispatch
│
├── middleware/
│   ├── authMiddleware.js      ← JWT token verification (protect routes)
│   ├── adminMiddleware.js     ← Role check: must be admin
│   ├── uploadMiddleware.js    ← Multer config for Excel and image files
│   └── errorMiddleware.js     ← Global error handler
│
├── models/
│   ├── User.js                ← Member and admin user schema
│   ├── Category.js            ← Top-level category schema
│   ├── Subcategory.js         ← Subcategory with parent reference
│   ├── Product.js             ← Full product schema
│   └── ImportBatch.js         ← Audit log for Excel imports
│
├── routes/
│   ├── authRoutes.js          ← /api/auth/*
│   ├── productRoutes.js       ← /api/products/*
│   ├── categoryRoutes.js      ← /api/categories/*
│   ├── imageRoutes.js         ← /api/images/*
│   └── contactRoutes.js       ← /api/contact
│
├── services/
│   ├── excelService.js        ← SheetJS parse + row validation logic
│   ├── imageMatchService.js   ← SKU-to-filename matching logic
│   ├── emailService.js        ← Nodemailer / SendGrid wrapper
│   └── cloudinaryService.js   ← Upload, delete, get URL helpers
│
├── utils/
│   ├── generateToken.js       ← JWT sign utility
│   ├── slugify.js             ← URL-safe slug generator
│   └── sanitise.js            ← Input sanitation helpers
│
├── uploads/                   ← Temp directory for Multer (gitignored)
│
├── .env                       ← Environment variables (never committed)
├── .env.example               ← Template with variable names only
├── server.js                  ← Express app entry point
└── package.json
```

### Key Dependency Map (Backend)

| Package                 | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `express`               | HTTP server and routing                           |
| `mongoose`              | MongoDB ODM / schema definitions                  |
| `jsonwebtoken`          | JWT sign and verify                               |
| `bcryptjs`              | Password hashing                                  |
| `multer`                | Multipart file upload handling                    |
| `xlsx` (SheetJS)        | Parse `.xlsx` / `.xls` Excel files                |
| `adm-zip`               | Extract ZIP archives for bulk image upload        |
| `cloudinary`            | Cloudinary SDK for image storage                  |
| `nodemailer`            | Contact form email dispatch                       |
| `cors`                  | Allow cross-origin requests from Netlify frontend |
| `dotenv`                | Load `.env` in development                        |
| `express-async-handler` | Clean async error forwarding                      |
| `helmet`                | HTTP security headers                             |
| `morgan`                | Request logging                                   |

---

## M2. Frontend Folder Structure

The frontend lives in the `Frontend/` folder. It is a standalone React application bootstrapped with Vite (preferred over Create React App for speed and modern defaults).

```
Frontend/
├── public/
│   └── favicon.ico
│
├── src/
│   ├── api/
│   │   ├── axiosInstance.js       ← Base Axios config (baseURL, interceptors)
│   │   ├── authApi.js             ← login(), register(), getMe()
│   │   ├── productApi.js          ← getProducts(), getProductById(), etc.
│   │   ├── categoryApi.js         ← getCategories(), getSubcategories()
│   │   ├── importApi.js           ← uploadExcel(), uploadImageZip()
│   │   └── contactApi.js          ← sendContactForm()
│   │
│   ├── assets/
│   │   └── images/                ← Static brand assets (logo, hero bg)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── PageWrapper.jsx
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Spinner.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Toast.jsx
│   │   │   ├── FormField.jsx
│   │   │   ├── Pagination.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── products/
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductGrid.jsx
│   │   │   └── OrderEmailButton.jsx
│   │   ├── categories/
│   │   │   ├── CategoryTile.jsx
│   │   │   └── SubcategoryCard.jsx
│   │   └── admin/
│   │       ├── ProductTable.jsx
│   │       ├── ExcelImportPanel.jsx
│   │       ├── ImageUploadPanel.jsx
│   │       └── StatsCard.jsx
│   │
│   ├── context/
│   │   └── AuthContext.jsx        ← Global auth state (user, token, login, logout)
│   │
│   ├── hooks/
│   │   ├── useAuth.js             ← Consume AuthContext
│   │   ├── useProducts.js         ← Fetch + cache product data
│   │   └── useCategories.js       ← Fetch + cache category data
│   │
│   ├── pages/
│   │   ├── public/
│   │   │   ├── HomePage.jsx
│   │   │   ├── CategoryPage.jsx
│   │   │   ├── SubcategoryPage.jsx
│   │   │   ├── ProductListPage.jsx    ← Members-gated
│   │   │   ├── UnderFivePage.jsx      ← Dynamic price filter page
│   │   │   └── ContactPage.jsx
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   └── admin/
│   │       ├── DashboardPage.jsx
│   │       ├── ProductsPage.jsx
│   │       ├── ImportPage.jsx
│   │       ├── ImagesPage.jsx
│   │       └── CategoriesPage.jsx
│   │
│   ├── routes/
│   │   ├── AppRouter.jsx          ← React Router DOM route definitions
│   │   ├── ProtectedRoute.jsx     ← Redirect to /login if not authenticated
│   │   └── AdminRoute.jsx         ← Redirect if not admin role
│   │
│   ├── utils/
│   │   ├── buildMailtoLink.js     ← Construct pre-filled mailto: string
│   │   └── formatPrice.js         ← Currency formatting helper
│   │
│   ├── App.jsx
│   ├── main.jsx                   ← Vite entry point
│   └── index.css                  ← Global styles / Tailwind directives
│
├── .env                           ← VITE_API_BASE_URL etc.
├── .env.example
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### Key Dependency Map (Frontend)

| Package                  | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `react` + `react-dom`    | UI rendering                               |
| `react-router-dom` v6    | Client-side routing                        |
| `axios`                  | HTTP requests to Express backend           |
| `tailwindcss`            | Utility-first CSS styling                  |
| `@headlessui/react`      | Accessible modals, dropdowns               |
| `react-hot-toast`        | Toast notifications                        |
| `react-hook-form`        | Form state and validation                  |
| `react-dropzone`         | Drag-and-drop file upload UI               |
| `react-table` (TanStack) | Admin product table with sorting/filtering |
| `jwt-decode`             | Read token expiry on client side           |
| `date-fns`               | Date formatting (last import date etc.)    |

---

## M3. MongoDB Schema Models

### 3.1 User Model

```
Collection: users

Fields:
  _id           ObjectId      (auto)
  name          String        required
  email         String        required, unique, lowercase, trimmed
  password      String        required, bcrypt-hashed (min 8 chars)
  company       String        optional
  role          String        enum: ['member', 'admin'], default: 'member'
  isApproved    Boolean       default: true  (set false for manual approval flow)
  createdAt     Date          auto (timestamps: true)
  updatedAt     Date          auto (timestamps: true)

Indexes:
  email         unique index
```

### 3.2 Category Model

```
Collection: categories

Fields:
  _id           ObjectId      (auto)
  name          String        required, trimmed
  slug          String        required, unique  (e.g., "rugby-replica-clothing")
  description   String        optional
  imageUrl      String        optional (Cloudinary URL)
  sortOrder     Number        default: 0
  isActive      Boolean       default: true
  createdAt     Date          auto
  updatedAt     Date          auto

Indexes:
  slug          unique index
```

### 3.3 Subcategory Model

```
Collection: subcategories

Fields:
  _id           ObjectId      (auto)
  category      ObjectId      ref: 'Category', required
  name          String        required, trimmed
  slug          String        required, unique  (e.g., "all-blacks")
  description   String        optional
  imageUrl      String        optional (Cloudinary URL)
  sortOrder     Number        default: 0
  isActive      Boolean       default: true
  createdAt     Date          auto
  updatedAt     Date          auto

Indexes:
  slug          unique index
  category      index (for filtered queries)
```

### 3.4 Product Model

```
Collection: products

Fields:
  _id             ObjectId      (auto)
  sku             String        required, unique, trimmed, uppercase
  name            String        required, trimmed
  description     String        optional
  subcategory     ObjectId      ref: 'Subcategory', optional
  category        ObjectId      ref: 'Category', optional  (denormalised for fast queries)
  brand           String        optional  (e.g., "adidas")
  price           Number        required, min: 0
  currency        String        default: 'GBP'
  sizes           [String]      optional  (e.g., ["S","M","L","XL"])
  quantityAvailable Number      default: 0
  imageUrl        String        optional (Cloudinary URL)
  imagePublicId   String        optional (Cloudinary public_id for deletion)
  isActive        Boolean       default: true
  createdAt       Date          auto
  updatedAt       Date          auto

Indexes:
  sku             unique index
  price           index (for Under £5 queries)
  category        index
  subcategory     index
  isActive        index
  text index on: name, description, brand  (for search)
```

### 3.5 ImportBatch Model

```
Collection: importbatches

Fields:
  _id             ObjectId      (auto)
  filename        String        required
  importedBy      ObjectId      ref: 'User'
  totalRows       Number
  importedRows    Number
  updatedRows     Number
  failedRows      Number
  errorLog        [Object]      array of { row, sku, reason }
  status          String        enum: ['pending','processing','complete','failed']
  createdAt       Date          auto
  updatedAt       Date          auto
```

---

## M4. REST API Endpoints

### Base URL

```
Development:  http://localhost:5000/api
Production:   https://oxford-sports-api.onrender.com/api
```

### 4.1 Auth Routes — `/api/auth`

| Method | Endpoint             | Access    | Description                 |
| ------ | -------------------- | --------- | --------------------------- |
| POST   | `/api/auth/register` | Public    | Register new member account |
| POST   | `/api/auth/login`    | Public    | Login, returns JWT          |
| GET    | `/api/auth/me`       | Protected | Get current user profile    |
| PUT    | `/api/auth/me`       | Protected | Update name / company       |

### 4.2 Category Routes — `/api/categories`

| Method | Endpoint                | Access | Description                                 |
| ------ | ----------------------- | ------ | ------------------------------------------- |
| GET    | `/api/categories`       | Public | List all active categories                  |
| GET    | `/api/categories/:slug` | Public | Get category + subcategories by slug        |
| POST   | `/api/categories`       | Admin  | Create new category                         |
| PUT    | `/api/categories/:id`   | Admin  | Update category                             |
| DELETE | `/api/categories/:id`   | Admin  | Soft-delete category (sets isActive: false) |

### 4.3 Subcategory Routes — `/api/subcategories`

| Method | Endpoint                   | Access | Description                                                |
| ------ | -------------------------- | ------ | ---------------------------------------------------------- |
| GET    | `/api/subcategories`       | Public | List all subcategories (optionally filter by ?category=id) |
| GET    | `/api/subcategories/:slug` | Public | Get subcategory detail                                     |
| POST   | `/api/subcategories`       | Admin  | Create subcategory                                         |
| PUT    | `/api/subcategories/:id`   | Admin  | Update subcategory                                         |
| DELETE | `/api/subcategories/:id`   | Admin  | Soft-delete subcategory                                    |

### 4.4 Product Routes — `/api/products`

| Method | Endpoint                   | Access | Description                                 |
| ------ | -------------------------- | ------ | ------------------------------------------- |
| GET    | `/api/products`            | Member | List products (supports query params below) |
| GET    | `/api/products/under-five` | Member | Products where price ≤ 5, isActive: true    |
| GET    | `/api/products/:id`        | Member | Single product by MongoDB `_id`             |
| GET    | `/api/products/sku/:sku`   | Member | Single product by SKU                       |
| POST   | `/api/products`            | Admin  | Create single product                       |
| PUT    | `/api/products/:id`        | Admin  | Update product                              |
| DELETE | `/api/products/:id`        | Admin  | Soft-delete product                         |

**Supported Query Parameters for `GET /api/products`:**

| Param         | Type     | Example               | Description                                              |
| ------------- | -------- | --------------------- | -------------------------------------------------------- |
| `category`    | ObjectId | `?category=abc123`    | Filter by category ID                                    |
| `subcategory` | ObjectId | `?subcategory=xyz789` | Filter by subcategory ID                                 |
| `maxPrice`    | Number   | `?maxPrice=5`         | Filter by maximum price                                  |
| `search`      | String   | `?search=arsenal`     | Full-text search (name, brand, description)              |
| `page`        | Number   | `?page=2`             | Pagination page number (default: 1)                      |
| `limit`       | Number   | `?limit=24`           | Items per page (default: 24, max: 100)                   |
| `sort`        | String   | `?sort=price_asc`     | Options: `price_asc`, `price_desc`, `name_asc`, `newest` |

**Standard Response Envelope:**

```
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 182,
    "pages": 8
  }
}
```

### 4.5 Import Routes — `/api/import`

| Method | Endpoint                         | Access | Description                                         |
| ------ | -------------------------------- | ------ | --------------------------------------------------- |
| POST   | `/api/import/excel`              | Admin  | Upload `.xlsx` file, returns preview of parsed rows |
| POST   | `/api/import/excel/confirm`      | Admin  | Confirm and execute the upsert of previewed rows    |
| POST   | `/api/import/images`             | Admin  | Upload ZIP of images, returns match report          |
| GET    | `/api/import/batches`            | Admin  | List past import batches with status                |
| GET    | `/api/import/batches/:id`        | Admin  | Get batch detail including full error log           |
| GET    | `/api/import/batches/:id/errors` | Admin  | Download error report as `.xlsx`                    |

### 4.6 Image Routes — `/api/images`

| Method | Endpoint                      | Access | Description                                        |
| ------ | ----------------------------- | ------ | -------------------------------------------------- |
| POST   | `/api/images/product/:id`     | Admin  | Upload/replace image for a single product          |
| POST   | `/api/images/category/:id`    | Admin  | Upload/replace image for a category                |
| POST   | `/api/images/subcategory/:id` | Admin  | Upload/replace image for a subcategory             |
| DELETE | `/api/images/product/:id`     | Admin  | Remove image from product + delete from Cloudinary |

### 4.7 Contact Route — `/api/contact`

| Method | Endpoint       | Access | Description                                          |
| ------ | -------------- | ------ | ---------------------------------------------------- |
| POST   | `/api/contact` | Public | Submit contact form, dispatches email via Nodemailer |

---

## M5. JWT Authentication Flow

### 5.1 Registration Flow

```
Client (React)                       Server (Express)
     │                                      │
     │── POST /api/auth/register ──────────►│
     │   { name, email, password, company } │
     │                                      │── Hash password (bcrypt, 10 rounds)
     │                                      │── Check email uniqueness
     │                                      │── Save User document to MongoDB
     │                                      │── Sign JWT (userId, role, 7d expiry)
     │◄─ { token, user: { id, name, role }} ─│
     │                                      │
     │── Store token in localStorage ───────│
     │   Update AuthContext state           │
```

### 5.2 Login Flow

```
Client (React)                       Server (Express)
     │                                      │
     │── POST /api/auth/login ─────────────►│
     │   { email, password }                │
     │                                      │── Find User by email
     │                                      │── Compare password (bcrypt.compare)
     │                                      │── If invalid → 401 Unauthorized
     │                                      │── Sign JWT (userId, role, 7d expiry)
     │◄─ { token, user: { id, name, role }} ─│
     │                                      │
     │── Store token in localStorage        │
     │── Set axios default header:          │
     │   Authorization: Bearer <token>      │
```

### 5.3 Authenticated Request Flow

```
Client                               Server (authMiddleware.js)
     │                                      │
     │── GET /api/products ────────────────►│
     │   Header: Authorization: Bearer xxx  │
     │                                      │── Extract token from header
     │                                      │── jwt.verify(token, JWT_SECRET)
     │                                      │── If invalid/expired → 401
     │                                      │── Attach req.user = decoded payload
     │                                      │── Call next() → productController
     │◄─ { success: true, data: [...] } ────│
```

### 5.4 JWT Payload Structure

```
{
  "id":    "64abc123...",   ← MongoDB User _id
  "role":  "member",        ← "member" or "admin"
  "iat":   1740000000,      ← Issued at (Unix timestamp)
  "exp":   1740604800       ← Expires at (7 days later)
}
```

### 5.5 Token Storage & Refresh Strategy

| Decision | Choice                                  | Reason                                                                           |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| Storage  | `localStorage`                          | Simple for this use case; members are trusted trade buyers, not public consumers |
| Expiry   | 7 days                                  | Long enough to avoid constant re-login for returning trade buyers                |
| Refresh  | Re-login on expiry (no refresh token)   | Sufficient for low-risk B2B use case; reduces complexity                         |
| Logout   | Clear `localStorage`, reset AuthContext | Immediate client-side invalidation                                               |

---

## M6. Protected Route Strategy

### 6.1 Frontend Route Protection

Three route wrapper components handle access control:

**`ProtectedRoute.jsx`** — for all member-gated pages:

```
Logic:
  IF token exists in localStorage AND user is loaded in AuthContext
    → render children (product pages)
  ELSE
    → redirect to /login with state: { from: currentPath }
      (after login, redirect back to the originally requested page)
```

**`AdminRoute.jsx`** — for all admin panel pages:

```
Logic:
  IF ProtectedRoute passes AND user.role === 'admin'
    → render children (admin panel pages)
  ELSE IF authenticated but not admin
    → redirect to / (home) with "Access Denied" toast
  ELSE
    → redirect to /login
```

### 6.2 Route Table

| Path                          | Component       | Protection                          |
| ----------------------------- | --------------- | ----------------------------------- |
| `/`                           | HomePage        | Public                              |
| `/category/:slug`             | CategoryPage    | Public                              |
| `/category/:catSlug/:subSlug` | SubcategoryPage | Public                              |
| `/products/:subSlug`          | ProductListPage | **Member Only**                     |
| `/under-5`                    | UnderFivePage   | **Member Only**                     |
| `/contact`                    | ContactPage     | Public                              |
| `/login`                      | LoginPage       | Public (redirect if already authed) |
| `/register`                   | RegisterPage    | Public (redirect if already authed) |
| `/admin`                      | DashboardPage   | **Admin Only**                      |
| `/admin/products`             | ProductsPage    | **Admin Only**                      |
| `/admin/import`               | ImportPage      | **Admin Only**                      |
| `/admin/images`               | ImagesPage      | **Admin Only**                      |
| `/admin/categories`           | CategoriesPage  | **Admin Only**                      |

### 6.3 Backend Route Protection

Every protected Express route passes through middleware in this order:

```
Router
  → authMiddleware    (verifies JWT, attaches req.user)
  → adminMiddleware   (checks req.user.role === 'admin', for admin-only routes)
  → controller function
```

Any route not explicitly protected remains public (categories list, homepage data, contact form).

---

## M7. Excel Import API Workflow

### 7.1 Two-Phase Import Design

The import is deliberately split into two API calls to prevent silent data corruption:

**Phase 1 — Parse & Preview** (`POST /api/import/excel`)
**Phase 2 — Confirm & Execute** (`POST /api/import/excel/confirm`)

### 7.2 Phase 1: Parse & Preview

```
1. Admin uploads .xlsx via drag-and-drop (react-dropzone)
2. Multer receives file → stored in /uploads/temp/ (not yet in DB)
3. excelService.parseFile(filePath) is called:
   a. SheetJS reads the workbook
   b. First sheet is read
   c. Row 1 is treated as column headers
   d. Headers are normalised (trim, lowercase, remove spaces)
   e. Known mappings are auto-detected:
      "sku" | "product code" | "item code"  →  sku
      "product name" | "name" | "title"     →  name
      "price" | "price (£)" | "unit price"  →  price
      "category"                             →  category
      "subcategory" | "club" | "team"        →  subcategory
      "description" | "desc"                →  description
      "sizes" | "size" | "size range"        →  sizes
      "qty" | "quantity" | "stock"           →  quantityAvailable
      "image" | "image file" | "filename"    →  imageHint
4. Returns to client:
   {
     "batchId": "temp-uuid",
     "detectedHeaders": ["SKU", "Product Name", ...],
     "mapping": { "sku": "SKU", "name": "Product Name", ... },
     "unmappedHeaders": ["Colour", "Weight"],
     "preview": [ first 10 rows as mapped objects ],
     "totalRows": 142
   }
```

### 7.3 Column Mapping UI (Frontend)

- Auto-mapped columns shown in green
- Unmapped columns shown with a dropdown for manual field assignment
- Admin can choose to ignore unmapped columns
- Admin confirms mapping → triggers Phase 2

### 7.4 Phase 2: Confirm & Execute

```
1. Client sends: { batchId, mapping (final confirmed), options }
   Options: { autoCreateCategories: true/false }
2. Server re-reads the temp file using the confirmed mapping
3. For each row:
   a. Validate required fields (sku, name, price)
   b. Resolve category:
      - Find Category by name (case-insensitive)
      - If not found AND autoCreateCategories: true → create with slug
      - If not found AND autoCreateCategories: false → skip row, log error
   c. Resolve subcategory (same logic as category, linked to parent)
   d. Parse sizes: split comma-separated string into array
   e. Upsert into products collection:
      - Filter: { sku: row.sku }
      - Update: all mapped fields
      - Options: { upsert: true, new: true }
   f. Track: imported (new), updated (existing), failed (validation error)
4. Delete temp file from /uploads/temp/
5. Save ImportBatch document with full log
6. Return:
   {
     "batchId": "...",
     "summary": {
       "total": 142,
       "imported": 89,
       "updated": 47,
       "failed": 6
     },
     "errors": [
       { "row": 23, "sku": null, "reason": "Missing SKU" },
       ...
     ]
   }
```

### 7.5 Error Report Download

- Failed rows are stored in `ImportBatch.errorLog`
- `GET /api/import/batches/:id/errors` regenerates an `.xlsx` file of only the failed rows
- Admin can fix these rows and re-upload (they will upsert harmlessly)

### 7.6 Idempotency Guarantee

Re-uploading the same Excel sheet is always safe:

- Existing SKUs are **updated** (never duplicated) via MongoDB `upsert`
- New SKUs are **inserted**
- No manual deduplication required by the admin

---

## M8. Image Upload API Workflow

### 8.1 Single Product Image Upload

```
POST /api/images/product/:id
Content-Type: multipart/form-data
Body: image file (jpg/png/webp, max 5MB)

Server steps:
1. Multer receives file into memory buffer (memoryStorage)
2. Validate: must be image MIME type
3. If product already has an imagePublicId → delete old image from Cloudinary
4. Upload buffer to Cloudinary:
   - Folder: "oxford-sports/products"
   - public_id: product.sku  (consistent, overwritable)
   - transformation: auto-format WebP, width: 800, quality: auto
5. Save returned URL and public_id to product document
6. Return updated product
```

### 8.2 Bulk ZIP Image Upload

```
POST /api/images (multipart, field: "archive")

Server steps:
1. Multer receives .zip file into /uploads/temp/
2. adm-zip extracts all entries to /uploads/temp/images-{batchId}/
3. imageMatchService.matchImagesToProducts() is called:
   a. Read all extracted filenames
   b. For each file:
      - Strip extension → expected SKU (e.g., "ADI-RM-001.jpg" → "ADI-RM-001")
      - Normalise: uppercase, trim
      - Query: Product.findOne({ sku: normalised, isActive: true })
      - If match found:
          * Upload to Cloudinary (same config as single upload)
          * Update product.imageUrl and product.imagePublicId
          * Record as "matched"
      - If no match:
          * Record filename in "unmatched" list
   c. After all files processed: delete temp directory
4. Return match report:
   {
     "matched": 34,
     "unmatched": 3,
     "unmatchedFiles": ["oddfile.jpg", "unknown-sku.png", "logo.jpg"],
     "errors": []
   }
```

### 8.3 Cloudinary Upload Configuration

| Setting         | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Folder          | `oxford-sports/products`                                 |
| Format          | `auto` (Cloudinary selects best format, typically WebP)  |
| Width           | Max 800px (auto height to maintain ratio)                |
| Quality         | `auto` (Cloudinary optimises file size)                  |
| Overwrite       | `true` (re-uploading same SKU replaces old image)        |
| Unique filename | `false` (SKU used as `public_id` for deterministic URLs) |

### 8.4 Image Naming Convention (for Client)

To use the bulk ZIP upload feature, the client must follow this convention:

| Rule         | Detail                                           |
| ------------ | ------------------------------------------------ |
| Filename     | Must exactly match the product SKU               |
| Case         | Must be UPPERCASE (system normalises both sides) |
| Extension    | `.jpg`, `.jpeg`, `.png`, or `.webp`              |
| Max size     | 5MB per image                                    |
| ZIP contents | Images in root of ZIP (no sub-folders)           |

Example:

```
images-batch-1.zip
├── ADI-RM-HOME-24-M.jpg
├── ADI-RM-AWAY-24-M.png
├── ALLBLK-HOME-24-L.jpg
└── ADI-JUV-AWAY-24-XL.webp
```

---

## M9. Deployment Architecture (Netlify + Render)

### 9.1 Architecture Diagram

```
User's Browser
      │
      ├──► Netlify CDN (React Frontend)
      │         │
      │         │── Static assets served from Netlify edge
      │         │── API calls: axios → Render backend
      │
      └──► Render (Node.js + Express Backend)
                │
                ├──► MongoDB Atlas (Database)
                └──► Cloudinary (Image Storage)
```

### 9.2 Frontend — Netlify

| Setting               | Value                  |
| --------------------- | ---------------------- |
| Repository            | GitHub `main` branch   |
| Build Command         | `npm run build` (Vite) |
| Publish Directory     | `dist/`                |
| Base Directory        | `Frontend/`            |
| Environment Variables | `VITE_API_BASE_URL`    |
| Auto Deploy           | On push to `main`      |
| Branch Previews       | Enabled for PRs        |

**Netlify Redirect Rule** (required for React Router client-side routing):

```
File: Frontend/public/_redirects

Content:
/*    /index.html    200
```

This ensures that navigating directly to `/products/arsenal` doesn't return a 404 from Netlify.

### 9.3 Backend — Render

| Setting               | Value                                      |
| --------------------- | ------------------------------------------ |
| Service Type          | Web Service                                |
| Repository            | GitHub `main` branch                       |
| Root Directory        | `Backend/`                                 |
| Build Command         | `npm install`                              |
| Start Command         | `node server.js`                           |
| Environment           | Node                                       |
| Instance Type         | Free tier (or Starter $7/mo for always-on) |
| Environment Variables | All `.env` values (see M10)                |
| Auto Deploy           | On push to `main`                          |

> **Note:** Render's free tier spins down after 15 minutes of inactivity (cold start ~30 seconds on first request).  
> For a production B2B site, the **Starter tier ($7/month)** is recommended to keep the service always-on.

### 9.4 Database — MongoDB Atlas

| Setting    | Value                                                                |
| ---------- | -------------------------------------------------------------------- |
| Provider   | MongoDB Atlas                                                        |
| Tier       | M0 Free (512MB) → upgrade to M2 ($9/mo) if needed                    |
| Region     | AWS EU West (Ireland) – nearest to UK                                |
| Connection | Via `MONGO_URI` environment variable in Render                       |
| IP Access  | Allow Render's outbound IPs (or allow all for simplicity: 0.0.0.0/0) |
| Backups    | Atlas free tier: no automated backups → export monthly via Atlas UI  |

### 9.5 Full Environment Flow

```
Development:
  Frontend  →  http://localhost:5173  (Vite dev server)
  Backend   →  http://localhost:5000  (Express)
  Database  →  MongoDB Atlas (same cluster, dev DB name)

Production:
  Frontend  →  https://oxfordsports.netlify.app  (then CNAME to oxfordsports.uk)
  Backend   →  https://oxford-sports-api.onrender.com
  Database  →  MongoDB Atlas (prod DB name)
```

### 9.6 Domain Setup for `oxfordsports.uk`

| Step | Action                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | In Netlify: Site Settings → Domain Management → Add custom domain → `oxfordsports.uk`               |
| 2    | In DNS registrar: Add CNAME `www` → `<netlify-subdomain>.netlify.app`                               |
| 3    | In DNS registrar: Add A record `@` → Netlify's load balancer IP (provided by Netlify)               |
| 4    | Netlify auto-provisions SSL via Let's Encrypt                                                       |
| 5    | Backend URL (`onrender.com`) does not need a custom domain — frontend calls it directly via env var |

---

## M10. Environment Variables

### 10.1 Backend — `Backend/.env`

```
# ── Server ─────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── MongoDB ─────────────────────────────────────────────────
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/oxford_sports

# ── JWT ─────────────────────────────────────────────────────
JWT_SECRET=your_strong_random_secret_min_32_chars
JWT_EXPIRES_IN=7d

# ── Cloudinary ──────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Email (Contact Form) ─────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password
CONTACT_EMAIL_TO=sales@oxfordsports.net
CONTACT_EMAIL_FROM=noreply@oxfordsports.uk

# ── CORS ────────────────────────────────────────────────────
CLIENT_ORIGIN=http://localhost:5173
```

### 10.2 Frontend — `Frontend/.env`

```
# ── API ─────────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:5000/api

# ── Business Info (used in mailto: builder) ──────────────────
VITE_ORDER_EMAIL=sales@oxfordsports.net
VITE_BUSINESS_PHONE=01869228107
```

### 10.3 Production Values (set in Render/Netlify dashboards, NOT in files)

| Variable            | Where Set | Production Value                                   |
| ------------------- | --------- | -------------------------------------------------- |
| `MONGO_URI`         | Render    | Atlas production connection string                 |
| `JWT_SECRET`        | Render    | Strong random secret (different from dev)          |
| `CLOUDINARY_*`      | Render    | Same Cloudinary account (or separate prod account) |
| `NODE_ENV`          | Render    | `production`                                       |
| `CLIENT_ORIGIN`     | Render    | `https://oxfordsports.uk`                          |
| `VITE_API_BASE_URL` | Netlify   | `https://oxford-sports-api.onrender.com/api`       |

### 10.4 `Backend/.env.example` (committed to Git)

The `.env` file itself is **never committed**. A `.env.example` with placeholder values is committed instead so any new developer knows exactly which variables to set.

The `.gitignore` must include:

```
Backend/.env
Frontend/.env
Backend/uploads/
```

---

## M10 Summary: Service Stack Comparison

| Service           | Purpose                        | Free Tier                             |
| ----------------- | ------------------------------ | ------------------------------------- |
| **Netlify**       | React frontend hosting         | Yes (100GB bandwidth)                 |
| **Render**        | Node.js/Express backend        | Yes (spins down); $7/mo for always-on |
| **MongoDB Atlas** | Database                       | Yes (512MB M0)                        |
| **Cloudinary**    | Image CDN + storage            | Yes (25GB)                            |
| **GitHub**        | Source control + CI/CD trigger | Yes                                   |

**Estimated monthly cost:**

- MVP launch: **£0**
- Production-grade (Render Starter, always-on): **~£6/month**

---

_MERN Architecture section added: February 26, 2026._
