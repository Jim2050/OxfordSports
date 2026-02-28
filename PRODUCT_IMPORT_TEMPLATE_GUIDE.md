# 📋 Product Import Template Guide

## 📄 **Sample File Location**

**File:** `Backend/SAMPLE_PRODUCTS_IMPORT_TEMPLATE.xlsx`

This Excel file contains:

- ✅ **7 sample products** with correct formatting
- ✅ **Instructions sheet** explaining each column
- ✅ **Ready to use** as a template for clients

---

## 📊 **Excel Format Requirements**

### **Required Columns:**

| Column Name      | Required | Type   | Example                       | Notes                                |
| ---------------- | -------- | ------ | ----------------------------- | ------------------------------------ |
| **SKU**          | ✅ YES   | Text   | `ADI-RUG-001`                 | Unique product code                  |
| **Product Name** | ✅ YES   | Text   | `All Blacks Home Jersey 2024` | Full product name                    |
| **Category**     | ✅ YES   | Text   | `Rugby`                       | Rugby, Football, Footwear, Clearance |
| **Brand**        | ✅ YES   | Text   | `adidas`                      | Brand name                           |
| **Price**        | ✅ YES   | Number | `24.99`                       | Price in £ (no currency symbol)      |
| **Sizes**        | ✅ YES   | Text   | `S,M,L,XL`                    | Comma-separated sizes                |

### **Optional Columns:**

| Column Name        | Type   | Example                         | Notes                            |
| ------------------ | ------ | ------------------------------- | -------------------------------- |
| **Description**    | Text   | `Authentic adidas rugby jersey` | Product description              |
| **Subcategory**    | Text   | `International`                 | Optional subcategory             |
| **Stock Quantity** | Number | `50`                            | Available quantity               |
| **Image URL**      | URL    | `https://...`                   | Cloudinary or external image URL |

---

## 📝 **Column Details**

### **1. SKU** (Required)

- **Format:** Text
- **Example:** `ADI-RUG-001`, `NIKE-FB-123`
- **Rules:**
  - Must be unique for each product
  - Can contain letters, numbers, hyphens
  - Recommended format: `BRAND-CATEGORY-NUMBER`

### **2. Product Name** (Required)

- **Format:** Text
- **Example:** `All Blacks Home Jersey 2024`
- **Rules:**
  - Clear, descriptive name
  - Include team/model name and year if applicable

### **3. Description** (Optional)

- **Format:** Text
- **Example:** `Authentic adidas All Blacks rugby jersey. High quality replica kit.`
- **Rules:**
  - Detailed product information
  - Can include features, materials, etc.

### **4. Category** (Required)

- **Format:** Text
- **Valid Options:**
  - `Rugby`
  - `Football`
  - `Footwear`
  - `Clearance`
- **Rules:** Must match one of the valid categories exactly

### **5. Subcategory** (Optional)

- **Format:** Text
- **Examples:** `International`, `Premier League`, `Football Boots`, `Training Wear`
- **Rules:** Use for additional product classification

### **6. Brand** (Required)

- **Format:** Text
- **Example:** `adidas`, `Nike`, `Puma`
- **Rules:** Brand name, typically lowercase

### **7. Price** (Required)

- **Format:** Number
- **Example:** `24.99`
- **Rules:**
  - Numbers only, no currency symbols
  - Use decimal point (not comma)
  - Represents price in £ (GBP)

### **8. Sizes** (Required)

- **Format:** Text (comma-separated)
- **Examples:**
  - Clothing: `S,M,L,XL,XXL`
  - Shoes: `7,8,9,10,11`
  - One size: `One Size`
- **Rules:**
  - Separate sizes with commas
  - No spaces after commas
  - Common sizes: XS, S, M, L, XL, XXL, XXXL

### **9. Stock Quantity** (Optional)

- **Format:** Number
- **Example:** `50`
- **Rules:** Whole number representing available stock

### **10. Image URL** (Optional)

- **Format:** URL (Text)
- **Example:** `https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/product.jpg`
- **Rules:**
  - Full URL to product image
  - Cloudinary URLs preferred
  - Must be publicly accessible

---

## 💼 **Sample Products Included**

The template includes 7 realistic examples:

1. **All Blacks Home Jersey 2024** - Rugby International (£24.99)
2. **France Rugby Away Shirt** - Rugby International (£22.50)
3. **Real Madrid Home Kit 2024** - Football La Liga (£29.99)
4. **Arsenal Away Jersey 2024** - Football Premier League (£27.50)
5. **Adidas Predator Elite FG** - Football Boots (£89.99)
6. **Training Jersey - Blue** - Clearance (£4.99)
7. **Basic Shorts - Black** - Clearance (£3.99)

---

## 🎯 **How Clients Should Use This Template**

### **Step 1: Open Template**

- Open `SAMPLE_PRODUCTS_IMPORT_TEMPLATE.xlsx`
- Review the "Instructions" sheet
- Look at sample products

### **Step 2: Prepare Data**

- Keep the same column headers
- Delete sample products (rows 2-8)
- Add your actual products

### **Step 3: Validate Data**

- ✅ All required columns filled
- ✅ SKUs are unique
- ✅ Prices are numbers only
- ✅ Categories match valid options
- ✅ Sizes are comma-separated

### **Step 4: Save & Upload**

- Save as `.xlsx` or `.csv`
- Upload via admin panel
- System will validate and import

---

## 🚀 **Importing Products**

### **Via Admin Panel:**

1. **Login** to admin dashboard
2. Go to **"Import Products"** section
3. Click **"Choose File"**
4. Select your Excel file
5. Click **"Import"**
6. Review import summary
7. Check imported products

### **System Validates:**

- ✅ Required fields present
- ✅ SKU uniqueness
- ✅ Valid categories
- ✅ Price format
- ✅ Data types

---

## ⚠️ **Common Errors & Solutions**

### **Error: "Missing required column: SKU"**

**Solution:** Ensure column header is exactly `SKU` (case-sensitive)

### **Error: "Duplicate SKU"**

**Solution:** Each SKU must be unique across all products

### **Error: "Invalid price format"**

**Solution:** Use numbers only: `24.99` (not `£24.99` or `24,99`)

### **Error: "Invalid category"**

**Solution:** Use only: Rugby, Football, Footwear, or Clearance

### **Error: "Sizes format invalid"**

**Solution:** Use comma-separated: `S,M,L,XL` (no spaces)

---

## 📧 **Client Support**

If clients have issues:

1. Provide this template
2. Direct them to the Instructions sheet
3. Ask them to match the sample format exactly
4. Verify their Excel file opens correctly

---

## 🎨 **Customization Tips**

### **For Bulk Imports:**

- Use Excel formulas to generate SKUs
- Copy formatting from samples
- Use data validation for categories
- Filter/sort before importing

### **For Image URLs:**

- Upload images to Cloudinary first
- Get public URLs
- Paste into Image URL column
- Or leave blank and upload later

---

## ✅ **Quality Checklist**

Before sending to client, verify template has:

- [ ] Clear column headers
- [ ] Sample products that match their inventory type
- [ ] Instructions sheet
- [ ] No formulas (plain values only)
- [ ] Proper column widths
- [ ] Valid example data

---

## 📦 **File Details**

**Filename:** `SAMPLE_PRODUCTS_IMPORT_TEMPLATE.xlsx`  
**Format:** Microsoft Excel (.xlsx)  
**Sheets:** 2 (Products, Instructions)  
**Sample Rows:** 7 products  
**Columns:** 10 (6 required, 4 optional)

---

**This template is ready to share with clients as a demonstration of the required format!** 🎉
