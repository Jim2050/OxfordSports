const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Sample products data in the exact format clients should use
const sampleProducts = [
  {
    SKU: "ADI-RUG-001",
    "Product Name": "All Blacks Home Jersey 2024",
    Description:
      "Authentic adidas All Blacks rugby jersey. High quality replica kit.",
    Category: "Rugby",
    Subcategory: "International",
    Brand: "adidas",
    Price: 24.99,
    Sizes: "S,M,L,XL",
    "Stock Quantity": 50,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/all-blacks-jersey.jpg",
  },
  {
    SKU: "ADI-RUG-002",
    "Product Name": "France Rugby Away Shirt",
    Description: "Official France FFR alternate jersey",
    Category: "Rugby",
    Subcategory: "International",
    Brand: "adidas",
    Price: 22.5,
    Sizes: "M,L,XL",
    "Stock Quantity": 35,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/france-rugby.jpg",
  },
  {
    SKU: "ADI-FB-001",
    "Product Name": "Real Madrid Home Kit 2024",
    Description: "Authentic adidas Real Madrid home shirt",
    Category: "Football",
    Subcategory: "La Liga",
    Brand: "adidas",
    Price: 29.99,
    Sizes: "S,M,L,XL,XXL",
    "Stock Quantity": 100,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/real-madrid.jpg",
  },
  {
    SKU: "ADI-FB-002",
    "Product Name": "Arsenal Away Jersey 2024",
    Description: "adidas Arsenal FC away kit",
    Category: "Football",
    Subcategory: "Premier League",
    Brand: "adidas",
    Price: 27.5,
    Sizes: "S,M,L,XL",
    "Stock Quantity": 75,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/arsenal-away.jpg",
  },
  {
    SKU: "ADI-FOOT-001",
    "Product Name": "Adidas Predator Elite FG",
    Description: "Professional football boots with Primeknit upper",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 89.99,
    Sizes: "7,8,9,10,11",
    "Stock Quantity": 45,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/predator-elite.jpg",
  },
  {
    SKU: "ADI-CLR-001",
    "Product Name": "Training Jersey - Blue",
    Description: "Clearance adidas training shirt",
    Category: "Clearance",
    Subcategory: "Training Wear",
    Brand: "adidas",
    Price: 4.99,
    Sizes: "M,L,XL",
    "Stock Quantity": 200,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/training-blue.jpg",
  },
  {
    SKU: "ADI-CLR-002",
    "Product Name": "Basic Shorts - Black",
    Description: "Simple adidas training shorts",
    Category: "Clearance",
    Subcategory: "Training Wear",
    Brand: "adidas",
    Price: 3.99,
    Sizes: "S,M,L",
    "Stock Quantity": 150,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1234567890/shorts-black.jpg",
  },
];

// Create workbook
const wb = XLSX.utils.book_new();

// Create worksheet from data
const ws = XLSX.utils.json_to_sheet(sampleProducts);

// Set column widths for better readability
ws["!cols"] = [
  { wch: 15 }, // SKU
  { wch: 35 }, // Product Name
  { wch: 50 }, // Description
  { wch: 15 }, // Category
  { wch: 20 }, // Subcategory
  { wch: 12 }, // Brand
  { wch: 10 }, // Price
  { wch: 20 }, // Sizes
  { wch: 15 }, // Stock Quantity
  { wch: 60 }, // Image URL
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, "Products");

// Create instructions sheet
const instructions = [
  {
    Column: "SKU",
    Required: "YES",
    Format: "Text",
    Example: "ADI-RUG-001",
    Notes: "Unique product code",
  },
  {
    Column: "Product Name",
    Required: "YES",
    Format: "Text",
    Example: "All Blacks Home Jersey 2024",
    Notes: "Full product name",
  },
  {
    Column: "Description",
    Required: "NO",
    Format: "Text",
    Example: "Authentic adidas rugby jersey",
    Notes: "Product description",
  },
  {
    Column: "Category",
    Required: "YES",
    Format: "Text",
    Example: "Rugby, Football, Footwear, Clearance",
    Notes: "Main product category",
  },
  {
    Column: "Subcategory",
    Required: "NO",
    Format: "Text",
    Example: "International, Premier League",
    Notes: "Optional subcategory",
  },
  {
    Column: "Brand",
    Required: "YES",
    Format: "Text",
    Example: "adidas",
    Notes: "Brand name",
  },
  {
    Column: "Price",
    Required: "YES",
    Format: "Number",
    Example: "24.99",
    Notes: "Price in £ (no symbols)",
  },
  {
    Column: "Sizes",
    Required: "YES",
    Format: "Text",
    Example: "S,M,L,XL",
    Notes: "Comma-separated sizes",
  },
  {
    Column: "Stock Quantity",
    Required: "NO",
    Format: "Number",
    Example: "50",
    Notes: "Available quantity",
  },
  {
    Column: "Image URL",
    Required: "NO",
    Format: "Text (URL)",
    Example: "https://...",
    Notes: "Cloudinary or external image URL",
  },
];

const wsInstructions = XLSX.utils.json_to_sheet(instructions);
wsInstructions["!cols"] = [
  { wch: 20 },
  { wch: 10 },
  { wch: 15 },
  { wch: 35 },
  { wch: 40 },
];

XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

// Save the file
const outputPath = path.join(__dirname, "SAMPLE_PRODUCTS_IMPORT_TEMPLATE.xlsx");
XLSX.writeFile(wb, outputPath);

console.log("✅ Sample Excel template created successfully!");
console.log(`📄 File location: ${outputPath}`);
console.log("\n📋 This template contains:");
console.log("   • 7 sample products with correct formatting");
console.log("   • Instructions sheet explaining each column");
console.log("   • Ready to use as demo for clients\n");
