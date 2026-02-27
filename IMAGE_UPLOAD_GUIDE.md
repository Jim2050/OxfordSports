# 📸 IMAGE UPLOAD GUIDE - 3 Easy Methods

## Method 1: Folder Upload (EASIEST - Recommended)

### Step 1: Prepare Your Images

1. Create a folder with product images
2. **Name each image by its SKU code**:
   ```
   S80602.jpg
   S80116.png
   S42737.webp
   JY2064.jpeg
   ```

### Step 2: Put Images in Upload Folder

```bash
Backend/uploads/product-images/
├── S80602.jpg
├── S80116.png
├── S42737.webp
└── JY2064.jpeg
```

### Step 3: Run Upload Script

```bash
cd E:\PPH_Ali\Backend
node upload-folder-images.js
```

**What happens:**

- ✅ All images uploaded to Cloudinary
- ✅ Automatically matched to products by SKU
- ✅ Database updated with Cloudinary URLs
- ✅ Images appear on website immediately

**Supported formats:** .jpg, .jpeg, .png, .gif, .webp

---

## Method 2: Admin Panel ZIP Upload in the admin panel:

1. Login to admin panel: http://localhost:5000/admin
2. Go to "Upload Images" section
3. Create a ZIP file with images named by SKU:
   ```
   product-images.zip
   ├── S80602.jpg
   ├── S80116.png
   └── S42737.webp
   ```
4. Upload the ZIP file
5. Images automatically matched and uploaded to Cloudinary

---

## Method 3: Excel-Based Image URLs (Current - Not Recommended)

Your Excel has Google search URLs which don't work as direct images.

**To fix:** Replace Image Link column URLs with:

- Direct image URLs (from your CDN/server)
- OR use Method 1 or 2 above (easier!)

---

## 🎯 Quick Start - Get Images Working NOW

### Option A: Use Sample Images (For Demo)

The system already has 39+ demo images from the image resolver.

### Option B: Add Your Own Images (Best for Production)

1. **Collect your product images** (from photographer, supplier, etc.)

2. **Rename images by SKU:**

   ```bash
   # Windows PowerShell
   cd "path\to\your\images"

   # Rename examples:
   Rename-Item "adidas-shoes-1.jpg" "S80602.jpg"
   Rename-Item "adidas-shoes-2.jpg" "S80116.jpg"
   ```

3. **Copy to upload folder:**

   ```bash
   Copy-Item *.jpg E:\PPH_Ali\Backend\uploads\product-images\
   ```

4. **Run uploader:**
   ```bash
   cd E:\PPH_Ali\Backend
   node upload-folder-images.js
   ```

**Done!** Images will appear on your website.

---

## 📊 Check Image Status

```bash
cd E:\PPH_Ali\Backend
node verify-production.js
```

Shows:

- How many products have images
- How many need images
- Sample image URLs

---

## 🔧 Troubleshooting

### Images not showing up?

**Check 1: Are images in Cloudinary?**

- Login to cloudinary.com
- Check "oxford-sports" folder
- Should see uploaded images

**Check 2: Check database:**

```bash
node -e "require('dotenv').config(); require('./config/db')().then(() => require('./models/Product').findOne({sku:'S80602'}).then(p => { console.log('Image:', p.imageUrl); process.exit(0); }));"
```

**Check 3: Check product page:**

- Open http://localhost:5173/product/S80602
- Open browser DevTools (F12)
- Check Console for image errors

### "Product SKU not found in database"?

The image filename doesn't match any SKU in your database.

**Fix:**

- Check SKU in database: `node check-excel.js` shows all SKUs
- Rename image to match exact SKU (case-sensitive)

### Upload fails?

**Check Cloudinary credentials:**

```bash
node -e "require('dotenv').config(); console.log('Cloud:', process.env.CLOUDINARY_CLOUD_NAME); console.log('Key:', process.env.CLOUDINARY_API_KEY);"
```

Should show your Cloudinary credentials from .env file.

---

## 🎨 Image Guidelines

### Recommended Image Specs:

- **Format:** JPG or PNG
- **Size:** 800x800px to 2000x2000px
- **Background:** White or transparent
- **File size:** Under 500KB per image

### Naming Convention:

```
✅ Correct:  S80602.jpg, S80116.PNG, s42737.webp
❌ Wrong:    adidas-1.jpg, shoe_001.png, product.jpg
```

**Important:** Filename (without extension) must exactly match the SKU in your database.

---

## 💡 Pro Tips

### 1. Batch Rename Images

**Windows PowerShell:**

```powershell
# If you have a CSV with: oldname, sku
$csv = Import-Csv mapping.csv
foreach ($row in $csv) {
    Rename-Item $row.oldname "$($row.sku).jpg"
}
```

### 2. Bulk Upload

You can upload 1000+ images at once - the script processes them all.

### 3. Update Existing Images

Just add new images with same SKU and run script with overwrite=true (already set).

### 4. Alternative: Direct Cloudinary Upload via Admin Panel

The ZIP upload in admin panel uses Cloudinary automatically - no script needed.

---

## 📁 Folder Structure

```
E:\PPH_Ali\Backend\
├── upload-folder-images.js    ← Run this script
└── uploads/
    └── product-images/        ← Put images here
        ├── S80602.jpg
        ├── S80116.png
        └── S42737.webp
```

---

## ✅ Summary

**Easiest Method:**

1. Name images by SKU (e.g., S80602.jpg)
2. Put in `Backend/uploads/product-images/`
3. Run `node upload-folder-images.js`
4. Done!

**Result:**

- Images on Cloudinary CDN (fast, reliable)
- Auto-matched to products
- Website shows images immediately
- Placeholder for products without images
