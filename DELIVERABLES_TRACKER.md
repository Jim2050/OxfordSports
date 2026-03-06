# Oxford Sports — Phase 2 Deliverables Tracker

> **Branch:** `changes-2026-03-06`  
> **Date:** March 6, 2026  
> **Total Items:** 20

## Deliverables Table

| Item # | Description | Status | From → To | Changes Made | Result |
|--------|-------------|--------|-----------|--------------|--------|
| 1 | Add ALL categories to homepage main section | ⏳ Needs Image/Data | — | — | Awaiting `WEBSITE_CATEGORIES_YASIR.xlsx` |
| 2 | Sign Out button → blue box + white text (more visible) | ✅ Completed | `btn-outline` (transparent bg, blue border) → inline style `background: #1a6fbf, color: #fff` (solid blue box, white text) | `Frontend/src/components/layout/Header.jsx` — changed button class & style | 100% accurate and working |
| 3 | Favorite heart → blank → red when clicked + bigger icon | ✅ Completed | Filled red `♥` (36px) → Outline gray `♡` (42px), turns solid red on click | `ProductCard.jsx` (♥→♡) + `index.css` (size 36→42px, color gray→red on click) | 100% accurate and working |
| 4 | Group same SKU products (1 listing + all sizes) | ⏳ Needs Context | — | — | Complex feature — needs design reference |
| 5 | Pro rata calculator (avg quantity per size display) | ⏳ Needs Context | — | — | Complex feature |
| 6 | "Out of Stock" → "Sold Out" under heart icon | ✅ Completed | "Out of stock" text → "Sold Out" everywhere + new red badge under heart when qty=0 | `ProductCard.jsx` (tooltip + badge), `ProductPage.jsx` (label), `index.css` (.sold-out-badge) | 100% accurate and working |
| 7 | Minimum order qty (footwear=24, t-shirts=100) | ⏳ Needs Context | — | — | Complex feature — needs rules confirmation |
| 8 | Add search bar in top banner | ✅ Completed | No search in header → Compact search bar between logo and nav, navigates to `/products?search=` | `Header.jsx` (search state + form + handler) + `index.css` (.header-search styles + responsive hide) | 100% accurate and working |
| 9 | Show item name instead of SKU in header | ✅ Completed | Name 1rem/700 weight, SKU 0.78rem → Name 1.05rem/800 weight (prominent), SKU 0.72rem lighter gray | `index.css` (h3 bolder, .sku smaller/lighter) | 100% accurate and working |
| 10 | Add RRP + discount display on each listing | ✅ Completed | RRP inline after price → RRP on own line with "RRP:" label, price-display column layout | `ProductCard.jsx` (price-display wrapper + "RRP:" label) + `index.css` (.price-display flex-column, .price-rrp block) | 100% accurate and working |
| 11 | SKU + gender tabs under each listing | ✅ Completed | SKU shown as plain text → SKU + gender as styled pill tags under product name | `ProductCard.jsx` (gender derivation + info-tag elements) + `index.css` (.product-info-tags, .info-tag-sku, .info-tag-gender) | 100% accurate and working |
| 12 | All product info on landing page (no click-through) | ⏳ Needs Image | — | — | Needs reference image |
| 13 | "Select Size" → "Buy Now" dark blue button | ✅ Completed | Red "Select Size" (btn-accent) → Dark blue "Buy Now" (btn-buynow #0f2d5c) | `ProductCard.jsx` (text + class) + `index.css` (.btn-buynow style) | 100% accurate and working |
| 14 | Bigger fonts entire top banner | ✅ Done | index.css | Header height 70→80px, logo 1.35→1.55rem, nav links 0.9→1rem weight 500→600, cart icon 1.4→1.55rem, logo img 48→54px | — |
| 15 | Homepage background stock image + remove chunky categories | ⏳ Needs Image | — | — | Needs background image |
| 16 | Sign-up form add delivery address + mobile number | ✅ Done | User.js, authController.js, AuthContext.jsx, RegisterPage.jsx | Added mobileNumber + deliveryAddress fields to model, controller, context, and form (textarea for address) | — |
| 17 | Sub-categories by gender for each main category | ⏳ Needs Data | — | — | Needs category structure |
| 18 | Additional sub-categories from old website | ⏳ Needs Data | — | — | Needs old website reference |
| 19 | Listing design light green discount + red "Order Item" only | ⏳ Needs Image | — | — | Needs design reference |
| 20 | Auto-categorize (FFR → Rugby/France sub-category) | ⏳ Needs Data | — | — | Needs category mapping rules |

## Legend
- 🔲 Pending — Ready to implement, no blockers
- 🔄 In Progress — Currently being worked on
- ✅ Completed — Done and verified
- ⏳ Needs Image/Data — Waiting for reference material from client
