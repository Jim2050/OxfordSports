# Oxford Sports — Phase 2 Deliverables Tracker

> **Branch:** `feature/changes-2026-03-06`  
> **Date:** March 6, 2026  
> **Total Items:** 20 original + client revision feedback  
> **Live Site:** https://www.oxfordsports.online/  
> **Repo:** Jim2050/OxfordSports (master = production)

---

## CLIENT FEEDBACK ON COMPLETED ITEMS (Revisions Needed)

Jim & Lily confirmed they love the changes but want these tweaks:

| Ref | What They Said | Affects Item | Action Required |
|-----|---------------|--------------|-----------------|
| R1 | Heart icon should ADD to cart directly, NOT navigate to product page. Just highlight when clicked. | #3 | Change heart click → addToCart (no navigation). Toggle highlight state. |
| R2 | Genre (gender) + SKU tags should be SAME color box, not different colors | #11 | Unify `.info-tag-sku` and `.info-tag-gender` to one style |
| R3 | Discount badge → same dark blue as Buy Now box, aligned NEXT to RRP on same line | #10 | Move discount % inline with price+RRP. Change discount color to `#0f2d5c` |
| R4 | Stock quantity → same dark blue color as Buy Now | #10 | Style stock info in dark blue |
| R5 | Add COLOR boxes next to genre and SKU tags | #11 | Add `product.color` as a third info-tag pill |
| R6 | Simplify: sale price + RRP + % discount ALL on one line (see reference image) | #10 | Restructure price-display to single horizontal row |
| R7 | Replace "X in stock" with "Available Sizes (X units)" + size boxes like "128(1) 176(1) 140(1)" | #12 | Redesign sizes section per reference image |
| R8 | SKU should show PARENT SKU not child SKU | #11 | Will resolve when #4 (SKU grouping) is implemented |
| R9 | No click-through product page — all info on the card | #12 | Card must show sizes/qty inline. Disable card link navigation. |
| R10 | Button text: "ORDER THIS ITEM" (red) instead of "Buy Now" | #13/#19 | Change button text + make it red per reference image |

---

## DELIVERABLES TABLE (Updated)

| # | Description | Status | Key Info Collected | Blocker |
|---|-------------|--------|--------------------|---------|
| 1 | Add ALL categories to homepage menu | 🔲 READY | Excel screenshot received — 9 top-level categories: HOME, FOOTWEAR, CLOTHING, LICENSED TEAM CLOTHING, ACCESSORIES, B GRADE, JOB LOTS, UNDER £5, BRANDS, SPORTS. Each has sub-categories + MENS/WOMENS/KIDS splits. | Need actual .xlsx file in project folder for parser |
| 2 | Sign Out → blue box + white text | ✅ DONE | Client loves it ✓ | — |
| 3 | Heart → highlight on click | ⚠️ REVISION | Client wants: click = add to cart directly (no navigation). Just highlight/fill when clicked. | — (can implement now) |
| 4 | Group same parent SKU → 1 card | 🔲 READY | CONFIRMED: All items with same Parent SKU under one card. One SKU with multiple sizes shown as size boxes "128(1) 176(1) 140(1)" | Need to know: which field is "parent SKU" in DB/Excel? |
| 5 | Pro rata calculator | ❓ SUPERSEDED? | The "Available Sizes (X units)" display may replace this. Client didn't mention pro rata specifically. | Confirm with client if still needed |
| 6 | "Sold Out" badge | ✅ DONE | Working ✓ | — |
| 7 | Minimum order quantity | 🔲 READY | **RULES CONFIRMED by Lily:** Shoes <12 units/line → MUST buy ALL. Clothing/accessories <50 units/line → MUST buy ALL. Lines over those quantities → qty adjustment allowed. **PLUS: £300 minimum cart total.** | — (can implement now) |
| 8 | Search bar in top banner | ✅ DONE | Client loves it ✓ | — |
| 9 | Item name prominent | ✅ DONE | Working ✓ | — |
| 10 | RRP + discount display | ⚠️ REVISION | Client wants: price + RRP + discount % ALL on ONE line (horizontal). Discount badge = dark blue like Buy Now. Stock info = dark blue. | — (can implement now) |
| 11 | SKU + gender tags | ⚠️ REVISION | Client wants: ALL tags same color. Add COLOR as a tag too. SKU = parent SKU (resolves with #4). | — (can implement now) |
| 12 | All product info on card (no click-through) | 🔲 READY | CONFIRMED + reference image received. Card shows: tags (SKU, gender), price/RRP/discount on one line, "Available Sizes (X units)" header, size boxes like "128(1)", and red "ORDER THIS ITEM" button. No card click navigation. | — (can implement now) |
| 13 | Buy Now button | ⚠️ REVISION | Client wants: RED "ORDER THIS ITEM" button (not dark blue "Buy Now"). See reference image. | — (can implement now) |
| 14 | Bigger fonts top banner | ✅ DONE | Client loves it ✓ | — |
| 15 | Homepage — remove chunky categories | 🔲 READY | CONFIRMED by Lily: Just remove the 4 large category boxes. No background image needed yet — "leave it as is, we will create one and send it over." | — (can implement now) |
| 16 | Signup: address + mobile | ✅ DONE | Working ✓ | — |
| 17 | Sub-categories by gender | 🔲 READY | Excel screenshot shows structure: each sub-cat has MENS/WOMENS/KIDS. E.g., Footwear → Trainers Mens / Womens / Kids. | Need .xlsx file for exact parsing |
| 18 | Additional sub-categories | 🔲 READY | Excel shows full list: FOOTWEAR(7 subs), CLOTHING(9 subs), LICENSED(7 subs), ACCESSORIES(9 subs), BRANDS(11), SPORTS(18). | Need .xlsx file |
| 19 | Card design per reference | 🔲 READY | Reference image received! Layout: tags at top → product name bold → price/RRP/discount on one line → "Available Sizes (X units)" → size boxes → heart icon + red "ORDER THIS ITEM" button | — (can implement now) |
| 20 | Auto-categorize | ⏳ PARTIAL | Lily provided examples: FFR=French Rugby, REAL=Real Madrid, FEF=Spain. Use descriptions+type from spreadsheets. Client will send full abbreviation list. | Waiting for full abbreviation mapping list |

---

## CATEGORY STRUCTURE (from Excel screenshot)

```
HOME
FOOTWEAR
  ├── Trainers (Mens/Womens/Kids)
  ├── Football Boots (Mens/Womens/Kids)
  ├── Rugby Boots (Mens/Womens/Kids)
  ├── Beach Footwear (Mens/Womens/Kids)
  ├── Golf Shoes (Mens/Womens/Kids)
  ├── Tennis/Padel Shoes (Mens/Womens/Kids)
  └── Specialist Footwear (Mens/Womens/Kids)
CLOTHING
  ├── Shirts (Mens/Womens/Kids)
  ├── Shorts (Mens/Womens/Kids)
  ├── Jackets & Coats (Mens/Womens/Kids)
  ├── Hoods & Sweaters (Mens/Womens/Kids)
  ├── Socks & Gloves (Mens/Womens/Kids)
  ├── Hats & Caps (Mens/Womens/Kids)
  ├── Tracksuits & Joggers (Mens/Womens/Kids)
  ├── Swimwear (Mens/Womens/Kids)
  ├── Leggings (Mens/Womens/Kids)
  └── Vests & Bras (Mens/Womens/Kids)
LICENSED TEAM CLOTHING
  ├── Shirts (Mens/Womens/Kids)
  ├── Jackets (Mens/Womens/Kids)
  ├── Hats & Caps (Mens/Womens/Kids)
  ├── Accessories
  ├── Tracksuits & Joggers (Mens/Womens/Kids)
  ├── Socks (Mens/Womens/Kids)
  └── Bags & Holdalls
ACCESSORIES
  ├── Balls
  ├── Bags & Holdalls
  ├── Headwear
  ├── Gloves
  ├── Rackets & Bats
  ├── Sports Towels
  ├── Protective Gear
  ├── Sunglasses
  └── Watches Monitors
B GRADE
JOB LOTS
UNDER £5
BRANDS
  ├── Adidas, Under Armour, Reebok, Puma, Castore
  ├── Nike, Molten, Gunn & Moore, Unicorn
  └── Uhlsport, New Balance
SPORTS
  ├── Football, Rugby, Cricket, Athletics, Swimming
  ├── Basketball, Hockey, Tennis, Badminton, Squash
  ├── Padel, Table Tennis, Cycling, Boxing/Martial Arts
  ├── Skiing/Snowboarding, Yoga/Fitness, Snooker/Pool
  └── Darts
```

---

## MOQ RULES (confirmed by Lily)

```
SHOES:
  - Line has < 12 units → Customer MUST buy ALL (no qty adjustment)
  - Line has ≥ 12 units → Customer can adjust quantity

CLOTHING & ACCESSORIES:
  - Line has < 50 units → Customer MUST buy ALL (no qty adjustment)
  - Line has ≥ 50 units → Customer can adjust quantity

CART MINIMUM:
  - Total cart value must be ≥ £300 to place order
```

---

## AUTO-CATEGORIZE RULES (partial — from Lily)

```
FFR  → Licensed Team Clothing > France (Rugby)
REAL → Licensed Team Clothing > Real Madrid
FEF  → Licensed Team Clothing > Spain
(Use product description + type fields from spreadsheet)
(Client will send full abbreviation list)
```
