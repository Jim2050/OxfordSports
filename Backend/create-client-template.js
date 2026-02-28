const XLSX = require("xlsx");
const path = require("path");

// Comprehensive product data with real examples and Cloudinary image URLs
const clientSampleProducts = [
  {
    SKU: "ADI-RUG-001",
    "Product Name": "New Zealand All Blacks Home Jersey 2024",
    Description:
      "Authentic adidas All Blacks home rugby jersey. Official replica with iconic black design and silver fern. Made from breathable Climalite fabric.",
    Category: "Rugby",
    Subcategory: "International Teams",
    Brand: "adidas",
    Price: 24.99,
    Sizes: "S,M,L,XL,XXL",
    "Stock Quantity": 75,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135280/oxford-sports/all-blacks-jersey.jpg",
  },
  {
    SKU: "ADI-RUG-002",
    "Product Name": "France Rugby Team Away Shirt 2024",
    Description:
      "Official France FFR alternate jersey in white with blue trim. High-performance rugby shirt with moisture-wicking technology.",
    Category: "Rugby",
    Subcategory: "International Teams",
    Brand: "adidas",
    Price: 22.5,
    Sizes: "M,L,XL,XXL",
    "Stock Quantity": 60,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135281/oxford-sports/france-rugby-away.jpg",
  },
  {
    SKU: "ADI-RUG-003",
    "Product Name": "England Rugby Home Shirt 2024",
    Description:
      "England RFU official home jersey. Classic white with red rose emblem. Premium quality rugby shirt.",
    Category: "Rugby",
    Subcategory: "International Teams",
    Brand: "adidas",
    Price: 26.99,
    Sizes: "S,M,L,XL,XXL",
    "Stock Quantity": 85,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135282/oxford-sports/england-rugby-home.jpg",
  },
  {
    SKU: "ADI-FB-001",
    "Product Name": "Real Madrid Home Kit 2024/25",
    Description:
      "Authentic adidas Real Madrid home shirt. Classic white with gold trim. Official La Liga merchandise.",
    Category: "Football",
    Subcategory: "La Liga",
    Brand: "adidas",
    Price: 29.99,
    Sizes: "S,M,L,XL,XXL",
    "Stock Quantity": 120,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135283/oxford-sports/real-madrid-home.jpg",
  },
  {
    SKU: "ADI-FB-002",
    "Product Name": "Arsenal Away Jersey 2024/25",
    Description:
      "adidas Arsenal FC away kit in navy blue. Official Premier League licensed product with club crest.",
    Category: "Football",
    Subcategory: "Premier League",
    Brand: "adidas",
    Price: 27.5,
    Sizes: "S,M,L,XL",
    "Stock Quantity": 95,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135284/oxford-sports/arsenal-away.jpg",
  },
  {
    SKU: "ADI-FB-003",
    "Product Name": "Manchester United Third Kit 2024",
    Description:
      "Official Man Utd third shirt in teal green. Limited edition design with Teamviewer sponsor.",
    Category: "Football",
    Subcategory: "Premier League",
    Brand: "adidas",
    Price: 28.99,
    Sizes: "M,L,XL,XXL",
    "Stock Quantity": 70,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135285/oxford-sports/man-utd-third.jpg",
  },
  {
    SKU: "ADI-FB-004",
    "Product Name": "Bayern Munich Home Shirt 2024",
    Description:
      "FC Bayern München home jersey. Classic red with Telekom sponsor. Bundesliga official merchandise.",
    Category: "Football",
    Subcategory: "Bundesliga",
    Brand: "adidas",
    Price: 26.5,
    Sizes: "S,M,L,XL,XXL",
    "Stock Quantity": 65,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135286/oxford-sports/bayern-home.jpg",
  },
  {
    SKU: "ADI-FOOT-001",
    "Product Name": "Adidas Predator Elite FG Football Boots",
    Description:
      "Professional football boots with Primeknit upper and Controlframe outsole. Elite performance for firm ground.",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 89.99,
    Sizes: "7,8,9,10,11,12",
    "Stock Quantity": 45,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135287/oxford-sports/predator-elite-fg.jpg",
  },
  {
    SKU: "ADI-FOOT-002",
    "Product Name": "Adidas Copa Pure 2 Elite FG",
    Description:
      "Premium leather football boots. Classic Copa styling with modern technology. Perfect touch and control.",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 94.99,
    Sizes: "7,8,9,10,11",
    "Stock Quantity": 35,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135288/oxford-sports/copa-pure-elite.jpg",
  },
  {
    SKU: "ADI-FOOT-003",
    "Product Name": "Adidas X Speedportal Elite FG",
    Description:
      "Speed boots designed for explosive acceleration. Lightweight carbon fiber outsole with Speedframe construction.",
    Category: "Footwear",
    Subcategory: "Football Boots",
    Brand: "adidas",
    Price: 79.99,
    Sizes: "7,8,9,10,11,12",
    "Stock Quantity": 50,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135289/oxford-sports/x-speedportal.jpg",
  },
  {
    SKU: "ADI-CLR-001",
    "Product Name": "Adidas Training Jersey - Navy Blue",
    Description:
      "Basic adidas training shirt. Climalite moisture management. Perfect for team training or casual wear.",
    Category: "Clearance",
    Subcategory: "Training Wear",
    Brand: "adidas",
    Price: 4.99,
    Sizes: "M,L,XL,XXL",
    "Stock Quantity": 250,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135290/oxford-sports/training-jersey-navy.jpg",
  },
  {
    SKU: "ADI-CLR-002",
    "Product Name": "Adidas Basic Shorts - Black",
    Description:
      "Simple adidas training shorts in black. Comfortable fit with drawstring waist. Clearance stock.",
    Category: "Clearance",
    Subcategory: "Training Wear",
    Brand: "adidas",
    Price: 3.99,
    Sizes: "S,M,L,XL",
    "Stock Quantity": 300,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135291/oxford-sports/shorts-black.jpg",
  },
  {
    SKU: "ADI-CLR-003",
    "Product Name": "Adidas Track Pants - Grey",
    Description:
      "Classic adidas track pants with three stripes. Comfortable cotton blend. Excellent value clearance item.",
    Category: "Clearance",
    Subcategory: "Training Wear",
    Brand: "adidas",
    Price: 4.5,
    Sizes: "M,L,XL",
    "Stock Quantity": 180,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135292/oxford-sports/track-pants-grey.jpg",
  },
  {
    SKU: "ADI-CLR-004",
    "Product Name": "Adidas Sports Socks - White (3 Pack)",
    Description:
      "Premium sports socks. Cushioned sole with arch support. Pack of 3 pairs.",
    Category: "Clearance",
    Subcategory: "Accessories",
    Brand: "adidas",
    Price: 2.99,
    Sizes: "One Size",
    "Stock Quantity": 400,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135293/oxford-sports/socks-white-pack.jpg",
  },
  {
    SKU: "ADI-CLR-005",
    "Product Name": "Adidas Cap - Black with Logo",
    Description:
      "Classic adidas baseball cap. Adjustable strap. Black with embroidered logo.",
    Category: "Clearance",
    Subcategory: "Accessories",
    Brand: "adidas",
    Price: 3.5,
    Sizes: "One Size",
    "Stock Quantity": 150,
    "Image URL":
      "https://res.cloudinary.com/dxsxoqiq3/image/upload/v1709135294/oxford-sports/cap-black.jpg",
  },
];

// Create workbook
const wb = XLSX.utils.book_new();

// Create main products worksheet
const ws = XLSX.utils.json_to_sheet(clientSampleProducts);

// Set column widths for optimal display
ws["!cols"] = [
  { wch: 18 }, // SKU
  { wch: 45 }, // Product Name
  { wch: 70 }, // Description
  { wch: 15 }, // Category
  { wch: 22 }, // Subcategory
  { wch: 12 }, // Brand
  { wch: 10 }, // Price
  { wch: 25 }, // Sizes
  { wch: 18 }, // Stock Quantity
  { wch: 80 }, // Image URL
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, "Products");

// Create detailed instructions sheet
const instructions = [
  {
    Step: "1",
    Action: "Column Headers",
    Details: "Keep these EXACT column names (case-sensitive)",
    Example: "SKU, Product Name, Description, Category, etc.",
  },
  {
    Step: "2",
    Action: "Required Fields",
    Details: "SKU, Product Name, Category, Brand, Price, Sizes MUST be filled",
    Example: "Every product needs these 6 columns",
  },
  {
    Step: "3",
    Action: "SKU Format",
    Details: "Must be unique. Recommended: BRAND-CATEGORY-NUMBER",
    Example: "ADI-FB-001, NIKE-RUG-123",
  },
  {
    Step: "4",
    Action: "Category Values",
    Details: "Must be one of: Rugby, Football, Footwear, Clearance",
    Example: "Case-sensitive - use exact spelling",
  },
  {
    Step: "5",
    Action: "Price Format",
    Details: "Numbers only, no currency symbols. Use decimal point.",
    Example: "24.99 (not £24.99 or 24,99)",
  },
  {
    Step: "6",
    Action: "Sizes Format",
    Details: "Comma-separated list with NO spaces",
    Example: "S,M,L,XL or 7,8,9,10",
  },
  {
    Step: "7",
    Action: "Image URLs",
    Details: "Full Cloudinary or external image URL (optional)",
    Example: "https://res.cloudinary.com/...",
  },
  {
    Step: "8",
    Action: "Data Validation",
    Details: "System checks: SKU uniqueness, required fields, formats",
    Example: "Import will fail if validation errors exist",
  },
  {
    Step: "9",
    Action: "Saving",
    Details: "Save as .xlsx or .csv format",
    Example: "Excel format preferred",
  },
  {
    Step: "10",
    Action: "Uploading",
    Details: "Admin Panel → Import Products → Choose File → Import",
    Example: "Review summary after import",
  },
];

const wsInstructions = XLSX.utils.json_to_sheet(instructions);
wsInstructions["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 60 }, { wch: 50 }];

XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

// Create summary sheet
const summary = [
  { Metric: "Total Products", Value: clientSampleProducts.length },
  {
    Metric: "Rugby Items",
    Value: clientSampleProducts.filter((p) => p.Category === "Rugby").length,
  },
  {
    Metric: "Football Items",
    Value: clientSampleProducts.filter((p) => p.Category === "Football").length,
  },
  {
    Metric: "Footwear Items",
    Value: clientSampleProducts.filter((p) => p.Category === "Footwear").length,
  },
  {
    Metric: "Clearance Items",
    Value: clientSampleProducts.filter((p) => p.Category === "Clearance")
      .length,
  },
  {
    Metric: "Price Range",
    Value: `£${Math.min(...clientSampleProducts.map((p) => p.Price))} - £${Math.max(...clientSampleProducts.map((p) => p.Price))}`,
  },
  {
    Metric: "Total Stock",
    Value: clientSampleProducts.reduce(
      (sum, p) => sum + p["Stock Quantity"],
      0,
    ),
  },
  {
    Metric: "Average Price",
    Value: `£${(clientSampleProducts.reduce((sum, p) => sum + p.Price, 0) / clientSampleProducts.length).toFixed(2)}`,
  },
];

const wsSummary = XLSX.utils.json_to_sheet(summary);
wsSummary["!cols"] = [{ wch: 25 }, { wch: 30 }];

XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

// Save the file
const outputPath = path.join(__dirname, "CLIENT_PRODUCTS_IMPORT_TEMPLATE.xlsx");
XLSX.writeFile(wb, outputPath);

console.log("\n✅ CLIENT IMPORT TEMPLATE CREATED SUCCESSFULLY!\n");
console.log("📄 File: CLIENT_PRODUCTS_IMPORT_TEMPLATE.xlsx");
console.log("📍 Location:", outputPath);
console.log("\n📊 TEMPLATE CONTENTS:");
console.log("   ✅ 15 Sample Products across all categories");
console.log("   ✅ Real product names and descriptions");
console.log("   ✅ Cloudinary image URLs included");
console.log("   ✅ Instructions sheet with 10-step guide");
console.log("   ✅ Summary sheet with statistics");
console.log("\n🎯 READY FOR:");
console.log("   • Local testing and validation");
console.log("   • Client demonstration");
console.log("   • Production import");
console.log("\n📋 PRODUCT BREAKDOWN:");
console.log("   • Rugby: 3 items (£22.50 - £26.99)");
console.log("   • Football: 4 items (£26.50 - £29.99)");
console.log("   • Footwear: 3 items (£79.99 - £94.99)");
console.log("   • Clearance: 5 items (£2.99 - £4.99)");
console.log(
  "   • Total Stock: " +
    clientSampleProducts.reduce((sum, p) => sum + p["Stock Quantity"], 0) +
    " units",
);
console.log("\n");
