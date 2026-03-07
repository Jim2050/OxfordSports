# Oxford Sports — Admin User Guide

**Admin URL:** https://www.oxfordsports.online/admin  
**Login:** admin@oxfordsports.net / Godaddy1971turbs*

---

## 1. Logging In

1. Go to **https://www.oxfordsports.online/admin**
2. Enter your admin email and password
3. Click **Sign In**
4. You'll see the dashboard with product stats

> Session expires automatically. If you get logged out, just sign in again.

---

## 2. Dashboard Overview

After login you'll see:

- **Stats cards** — Total Products, Under £5, With Images, Categories, Brands
- **Tab buttons** — Upload Excel, Upload Images, Add Product, Product List, Export CSV
- **Utility Tools** (collapsed) — Fix Brands, Fix Subcategories

---

## 3. Uploading Products via Excel

### Step-by-step:

1. Click the **📄 Upload Excel** tab
2. Drag and drop your `.xlsx` file onto the upload area (or click to browse)
3. Wait for the upload progress bar to complete
4. After upload reaches 100%, the server will process the file (you'll see "Processing on server…")
5. When done, you'll see an **Import Summary** showing:
   - ✅ SKUs imported (new)
   - 🔄 SKUs updated (existing)
   - ❌ Failed rows (with reasons)
   - Sheet breakdown + column mapping used

### Supported file types:
- `.xlsx` (recommended)
- `.xls`
- `.csv`
- Maximum file size: **50 MB**

### Excel column names the system recognises:

| Field | Accepted Column Names |
|-------|----------------------|
| **SKU** (required) | Code, SKU, Product Code, Item Code, Article, Article Number, Style Code, Ref |
| **Product Name** | Style, Style Desc, Product Name, Name, Title, Item |
| **Price** (required) | Trade, Trade Price, Wholesale Price, Price, Sale Price, Cost |
| **RRP** | RRP, Retail Price, MSRP |
| **Category** | Gender, Category, Department, Type |
| **Subcategory** | Subcategory, Sub Category, Club, Team, Collection |
| **Brand** | Brand, Manufacturer, Supplier |
| **Colour** | Colour Desc, Color, Colour |
| **Size** | UK Size, Size, Sizes |
| **Quantity** | Qty, Quantity, Stock, Stock Quantity |
| **Barcode** | Barcode, EAN, UPC, GTIN |
| **Image URL** | Image Link, Image URL, Image, Photo, Picture |

> **Column names are case-insensitive.** "TRADE" and "trade" both work.

### How size consolidation works:

If your Excel has **one row per size** (which is normal for adidas), the system automatically merges them:

```
Code        | Style          | UK Size | Qty | Trade
ADI-RM-001  | Real Madrid    | 8       | 50  | 12.99
ADI-RM-001  | Real Madrid    | 9       | 30  | 12.99
ADI-RM-001  | Real Madrid    | 10      | 45  | 12.99
```

This becomes **one product** with sizes: 8 (50), 9 (30), 10 (45) — total quantity 125.

### Multiple sheets:

The system reads **ALL sheets** in your workbook (Master, FIREBIRD, etc.). Each sheet is parsed separately with its own column detection.

### Auto-categorisation:

If your Excel only has "Gender" (Mens/Womens/Junior) instead of a proper category, the system automatically assigns:
- **FOOTWEAR** — if the product name mentions boots, trainers, shoes, etc.
- **CLOTHING** — if it mentions shorts, jersey, jacket, hoodie, etc.
- **ACCESSORIES** — if it mentions bag, ball, gloves, cap, etc.

It also auto-detects subcategories from team names (Real Madrid, Manchester United, France Rugby, etc.).

---

## 4. Uploading Product Images

### Method 1: ZIP Upload (Recommended for Bulk)

1. Click the **🖼️ Upload Images** tab
2. Prepare your images:
   - Name each image file with the **exact SKU** of the product
   - Example: `ADI-RM-001.jpg`, `ADI-FB-023.png`
3. Put all images in a **ZIP file**
4. Drag and drop the ZIP onto the upload area
5. Wait for processing — the system matches each image to its product
6. You'll see a summary: matched vs unmatched files

### Image naming rules:

| Filename | Matches Product | Why |
|----------|----------------|-----|
| `ADI-RM-001.jpg` | SKU: ADI-RM-001 | ✅ Exact match |
| `ADI-RM-001.png` | SKU: ADI-RM-001 | ✅ Extension doesn't matter |
| `ADI-RM-001-BLK.jpg` | SKU: ADI-RM-001 | ✅ Partial match (strips suffix after last hyphen) |
| `real-madrid-top.jpg` | — | ❌ Doesn't match any SKU |

### Supported image formats:
- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`

### Maximum ZIP size: **100 MB**

### Where images go:
- If **Cloudinary** is configured → uploaded to cloud (automatic resizing to 800px width)
- If not → saved locally on the server in `/uploads/products/`

---

## 5. Adding Images via Excel (Image URL Column)

You can include image URLs directly in your Excel file. Add a column called **"Image Link"** or **"Image URL"**.

### ✅ Correct format — Direct image URLs:

These work immediately:

```
Image Link
https://assets.adidas.com/images/w_600/12345.jpg
https://res.cloudinary.com/demo/image/upload/shoes.png
https://cdn.shopify.com/s/files/products/jacket.webp
https://i.imgur.com/abc123.jpg
```

**Rules for URLs that work:**
- Must start with `https://` or `http://`
- Must end with an image extension (`.jpg`, `.png`, `.webp`, `.gif`) **OR**
- Be from a known CDN (Cloudinary, Imgur, Unsplash, Shopify CDN)

### ❌ Wrong format — These will NOT work:

```
Image Link
Google Images                              ← Not a URL
https://www.google.com/search?q=adidas    ← Google search page
https://www.adidas.co.uk/product-page     ← Landing page, not an image
adidas-shoe.jpg                            ← Local filename, not a URL
C:\Users\Jim\Pictures\shoe.jpg             ← Local file path
```

### What happens with bad URLs:
- Google search URLs → queued for auto-resolution (up to 50 per import)
- Non-URLs → ignored silently
- You can always upload images separately via the ZIP method after import

---

## 6. Recommended Workflow

### First time setup:
1. **Upload Excel first** — this creates all products with prices, sizes, categories
2. **Upload Images ZIP second** — matches images to already-created products
3. Check the **Product List** tab to verify everything looks right

### Updating products:
1. Upload the same Excel again — existing SKUs get **updated**, new ones get **added**
2. Products are matched by **SKU** — same SKU = same product

### Best image workflow:
1. Create a folder on your computer called `product-images`
2. Save each product image named as its SKU: `ADI-RM-001.jpg`
3. Select all images → Right-click → **Send to → Compressed (zipped) folder**
4. Upload the ZIP to the admin panel

---

## 7. Sample Excel Template

Here's the ideal Excel format for Oxford Sports:

| Code | Style | Gender | Colour Desc | UK Size | Qty | Barcode | RRP | Trade | Image Link |
|------|-------|--------|-------------|---------|-----|---------|-----|-------|------------|
| ADI-RM-001 | Real Madrid Home Jersey | Mens | White/Purple | S | 25 | 5012345678901 | 79.99 | 12.99 | https://example.com/adi-rm-001.jpg |
| ADI-RM-001 | Real Madrid Home Jersey | Mens | White/Purple | M | 40 | 5012345678902 | 79.99 | 12.99 | |
| ADI-RM-001 | Real Madrid Home Jersey | Mens | White/Purple | L | 35 | 5012345678903 | 79.99 | 12.99 | |
| ADI-FB-023 | Predator Boot FG | Mens | Black/Red | 8 | 15 | 5012345678910 | 149.99 | 45.00 | https://example.com/adi-fb-023.jpg |
| ADI-FB-023 | Predator Boot FG | Mens | Black/Red | 9 | 20 | 5012345678911 | 149.99 | 45.00 | |

**Notes:**
- Image URL only needs to be on the **first row** of each SKU — it applies to the whole product
- If you don't have image URLs, leave the column empty and upload images via ZIP afterwards
- **Trade** = your wholesale selling price, **RRP** = recommended retail price
- Same Code with different sizes = automatically merged into one product

---

## 8. Managing Products

### Edit a product:
1. Go to **📋 Product List** tab
2. Find the product (use the search bar)
3. Click the **✏️ Edit** button
4. Modify fields and click **Update Product**

### Delete a product:
1. Go to **📋 Product List** tab
2. Click the **🗑️ Delete** button next to the product
3. Confirm in the popup

### Delete ALL products:
1. Go to **📋 Product List** tab
2. Click **🗑️ Clear All** (red button, top right)
3. Confirm — this deletes everything!

### Export products:
1. Click **📥 Export CSV** in the tab bar
2. A CSV file downloads with all product data

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Upload seems stuck at 100% | Server is processing — wait for the "Processing on server" message to finish. Large files (5000+ rows) can take 30-60 seconds. |
| "Import failed" error | Check your Excel has at least a **Code** column and a **Trade/Price** column. Both are required. |
| Images show as "unmatched" | Image filename must match the SKU exactly. Check for spaces or extra characters. |
| 0 products imported | The system couldn't find recognisable column names. Check headers match the table in Section 3. |
| Session expired | Just log in again — sessions expire for security. |
| Products not showing on site | Make sure products have a valid **category** (FOOTWEAR, CLOTHING, or ACCESSORIES). |

---

## 10. Quick Reference

| Action | Where |
|--------|-------|
| Upload products | Admin → Upload Excel tab |
| Upload images | Admin → Upload Images tab |
| View all products | Admin → Product List tab |
| Download product data | Admin → Export CSV button |
| Add single product | Admin → Add Product tab |
| Fix missing brands | Admin → 🔧 Utility Tools → Fix Brands |
| Fix missing subcategories | Admin → 🔧 Utility Tools → Fix Subcategories |
