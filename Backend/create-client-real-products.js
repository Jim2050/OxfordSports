const XLSX = require("xlsx");
const path = require("path");

// Real products from client with working Cloudinary URLs
const clientRealProducts = [
  {
    SKU: "S80602",
    "Product Name": "adidas Nemeziz 17.3 FG Football Boots",
    Description:
      "Mens adidas Nemeziz 17.3 FG football boots in solar yellow. Firm ground soccer cleats with agility mesh upper.",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 26.44,
    Sizes: "8",
    "Stock Quantity": 1,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1764218667/cld-sample-5.jpg",
  },
  {
    SKU: "S80116",
    "Product Name": "adidas Tubular Radial Trainers",
    Description:
      "Mens adidas Tubular Radial sneakers in red. Modern street style with tubular outsole technology.",
    Category: "Footwear",
    Subcategory: "Trainers",
    Brand: "adidas",
    Price: 28.6,
    Sizes: "4",
    "Stock Quantity": 1,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1764218668/main-sample.png",
  },
  {
    SKU: "S79492",
    "Product Name": "adidas X 16.3 FG J Junior Football Boots",
    Description:
      "Junior adidas X 16.3 FG football boots in core black. Youth soccer cleats designed for speed and performance.",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 19.07,
    Sizes: "33",
    "Stock Quantity": 2,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1764218667/cld-sample-4.jpg",
  },
];

// Create workbook
const wb = XLSX.utils.book_new();

// Create products worksheet
const ws = XLSX.utils.json_to_sheet(clientRealProducts);

// Set column widths
ws["!cols"] = [
  { wch: 15 }, // SKU
  { wch: 50 }, // Product Name
  { wch: 70 }, // Description
  { wch: 15 }, // Category
  { wch: 20 }, // Subcategory
  { wch: 12 }, // Brand
  { wch: 10 }, // Price
  { wch: 15 }, // Sizes
  { wch: 18 }, // Stock Quantity
  { wch: 80 }, // Image URL
];

XLSX.utils.book_append_sheet(wb, ws, "Products");

// Create Instructions Sheet
const instructions = [
  {
    Column: "SKU",
    Required: "YES",
    Format: "Unique product code",
    Example: "S80602, ADI-FB-001",
  },
  {
    Column: "Product Name",
    Required: "YES",
    Format: "Full product name",
    Example: "adidas Nemeziz 17.3 FG Football Boots",
  },
  {
    Column: "Description",
    Required: "NO",
    Format: "Product details",
    Example: "Mens adidas football boots in solar yellow...",
  },
  {
    Column: "Category",
    Required: "YES",
    Format: "Rugby, Football, Footwear, or Clearance",
    Example: "Footwear",
  },
  {
    Column: "Subcategory",
    Required: "NO",
    Format: "Product type/team",
    Example: "Football Boots, Trainers",
  },
  {
    Column: "Brand",
    Required: "YES",
    Format: "Brand name",
    Example: "adidas, Nike, Canterbury",
  },
  {
    Column: "Price",
    Required: "YES",
    Format: "Number only (no £)",
    Example: "26.44",
  },
  {
    Column: "Sizes",
    Required: "YES",
    Format: "Comma-separated, NO spaces",
    Example: "S,M,L,XL or 7,8,9,10",
  },
  {
    Column: "Stock Quantity",
    Required: "NO",
    Format: "Number",
    Example: "10",
  },
  {
    Column: "Image URL",
    Required: "NO",
    Format: "Full Cloudinary URL",
    Example: "https://res.cloudinary.com/dxsxoqiq3/...",
  },
];

const wsInstructions = XLSX.utils.json_to_sheet(instructions);
wsInstructions["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 50 }];

XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

// Create Sample Format sheet (showing client's data mapped to our format)
const sampleMapping = [
  {
    "Client Column": "Code",
    "Maps To": "SKU",
    Example: "S80602",
  },
  {
    "Client Column": "Style",
    "Maps To": "Product Name",
    Example: "NEMEZIZ 17.3 FG",
  },
  {
    "Client Column": "Gender + Style",
    "Maps To": "Product Name (combined)",
    Example: "Mens NEMEZIZ 17.3 FG",
  },
  {
    "Client Column": "Colour Desc",
    "Maps To": "Description (optional)",
    Example: "solar yellow",
  },
  {
    "Client Column": "UK Size",
    "Maps To": "Sizes",
    Example: "8 (or 7,8,9 for multiple)",
  },
  {
    "Client Column": "RRP",
    "Maps To": "RRP (optional)",
    Example: "79.95",
  },
  {
    "Client Column": "SALE",
    "Maps To": "Price",
    Example: "26.44",
  },
  {
    "Client Column": "Qty",
    "Maps To": "Stock Quantity",
    Example: "1",
  },
  {
    "Client Column": "Image Link",
    "Maps To": "Image URL",
    Example: "https://res.cloudinary.com/...",
  },
];

const wsMapping = XLSX.utils.json_to_sheet(sampleMapping);
wsMapping["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 40 }];

XLSX.utils.book_append_sheet(wb, wsMapping, "Column Mapping Guide");

// Save file
const outputPath = path.join(__dirname, "CLIENT_REAL_PRODUCTS_TEMPLATE.xlsx");
XLSX.writeFile(wb, outputPath);

console.log("\n✅ CLIENT REAL PRODUCTS TEMPLATE CREATED!\n");
console.log("📄 File: CLIENT_REAL_PRODUCTS_TEMPLATE.xlsx");
console.log("📍 Location:", outputPath);
console.log("\n📦 CONTAINS:");
console.log("   ✅ 3 Real Products from Client");
console.log("   ✅ Working Cloudinary Image URLs");
console.log("   ✅ Proper column format for import");
console.log("   ✅ Instructions sheet");
console.log("   ✅ Column mapping guide (client format → our system)");
console.log("\n🎯 PRODUCTS:");
console.log("   1. adidas Nemeziz 17.3 FG - £26.44");
console.log("   2. adidas Tubular Radial - £28.60");
console.log("   3. adidas X 16.3 FG J Junior - £19.07");
console.log("\n🖼️  All images use working Cloudinary URLs!");
console.log("\n");
