const LABEL_OVERRIDES = {
  HOME: "Home",
  FOOTWEAR: "Footwear",
  CLOTHING: "Clothing",
  "LICENSED TEAM CLOTHING": "Licensed Team Clothing",
  ACCESSORIES: "Accessories",
  "B GRADE": "B Grade",
  "JOB LOTS": "Job Lots",
  "UNDER £5": "Under £5",
  BRANDS: "Brands",
  SPORTS: "Sports",
  TRAINERS: "Trainers",
  "FOOTBALL TRAINERS": "Football Trainers",
  "FOOTBALL BOOTS": "Football Boots",
  "RUGBY BOOTS": "Rugby Boots",
  "SLIDES, FLIP FLOPS & SANDALS": "Slides, Flip Flops & Sandals",
  "GOLF SHOES": "Golf Shoes",
  "TENNIS / PADEL & RACKET SPORT SHOES": "Tennis / Padel & Racket Sport Shoes",
  "SPECIALIST FOOTWEAR": "Specialist Footwear",
  "WINTER FOOTWEAR": "Winter Footwear",
  "HIKING BOOTS": "Hiking Boots",
  "RUNNING SHOES": "Running Shoes",
  "POLO SHIRTS": "Polo Shirts",
  "T-SHIRTS": "T-Shirts",
  SHORTS: "Shorts",
  "JACKETS & COATS": "Jackets & Coats",
  "HOODED SWEATERS": "Hooded Sweaters",
  "JUMPERS & SWEATERS": "Jumpers & Sweaters",
  GLOVES: "Gloves",
  SOCKS: "Socks",
  HEADWEAR: "Headwear",
  "TRACKSUIT BOTTOMS": "Tracksuit Bottoms",
  "TRACKSUITS JACKETS": "Tracksuit Jackets",
  "TRACKSUIT SETS": "Tracksuit Sets",
  SWIMWEAR: "Swimwear",
  LEGGINGS: "Leggings",
  "VESTS & BRAS": "Vests & Bras",
  "SKIRTS & SKORTS": "Skirts & Skorts",
  "DRESSES & BODYSUITS": "Dresses & Bodysuits",
  "SPECIALIST CLOTHING": "Specialist Clothing",
  "TEAM JERSEYS": "Team Jerseys",
  "ACCESSORIES & MEMORABILIA": "Accessories & Memorabilia",
  "BAGS & HOLDALLS": "Bags & Holdalls",
  BALLS: "Balls",
  "RACKETS & BATS": "Rackets & Bats",
  "SPORTS TOWELS": "Sports Towels",
  "PROTECTIVE GEAR": "Protective Gear",
  SUNGLASSES: "Sunglasses",
  "WATCHES MONITORS": "Watches Monitors",
  "GYM EQUIPMENT": "Gym Equipment",
  TOWELS: "Towels",
  FOOTBALL: "Football",
  RUGBY: "Rugby",
  CRICKET: "Cricket",
  ATHLETICS: "Athletics",
  SWIMMING: "Swimming",
  BASKETBALL: "Basketball",
  HOCKEY: "Hockey",
  TENNIS: "Tennis",
  BADMINTON: "Badminton",
  SQUASH: "Squash",
  PADEL: "Padel",
  "TABLE TENNIS": "Table Tennis",
  CYCLING: "Cycling",
  "BOXING / MARTIAL ARTS": "Boxing / Martial Arts",
  "SKIING / SNOWBOARDING": "Skiing / Snowboarding",
  "YOGA / FITNESS": "Yoga / Fitness",
  "SNOOKER / POOL": "Snooker / Pool",
  DARTS: "Darts",
  ADIDAS: "Adidas",
  "UNDER ARMOUR": "Under Armour",
  REEBOK: "Reebok",
  PUMA: "Puma",
  CASTORE: "Castore",
  NIKE: "Nike",
  MOLTEN: "Molten",
  "GUNN & MOORE": "Gunn & Moore",
  UNICORN: "Unicorn",
  UHLSPORT: "Uhlsport",
  "NEW BALANCE": "New Balance",
};

const TITLE_CASE_EXCEPTIONS = new Set(["and", "of", "the"]);

const NAV_SUBCATEGORY_FALLBACKS = {
  FOOTWEAR: [
    "TRAINERS",
    "FOOTBALL TRAINERS",
    "FOOTBALL BOOTS",
    "RUGBY BOOTS",
    "SLIDES, FLIP FLOPS & SANDALS",
    "GOLF SHOES",
    "TENNIS / PADEL & RACKET SPORT SHOES",
    "SPECIALIST FOOTWEAR",
    "WINTER FOOTWEAR",
    "HIKING BOOTS",
    "RUNNING SHOES",
  ],
  CLOTHING: [
    "POLO SHIRTS",
    "T-SHIRTS",
    "SHORTS",
    "JACKETS & COATS",
    "HOODED SWEATERS",
    "JUMPERS & SWEATERS",
    "GLOVES",
    "SOCKS",
    "HEADWEAR",
    "TRACKSUIT BOTTOMS",
    "TRACKSUITS JACKETS",
    "TRACKSUIT SETS",
    "SWIMWEAR",
    "LEGGINGS",
    "VESTS & BRAS",
    "SKIRTS & SKORTS",
    "DRESSES & BODYSUITS",
    "SPECIALIST CLOTHING",
  ],
  "LICENSED TEAM CLOTHING": [
    "TEAM JERSEYS",
    "T-SHIRTS",
    "JACKETS & COATS",
    "HEADWEAR",
    "ACCESSORIES & MEMORABILIA",
    "TRACKSUIT JACKETS",
    "TRACKSUIT BOTTOMS",
    "SOCKS",
    "BAGS & HOLDALLS",
    "SHORTS",
    "HOODED SWEATERS",
    "JUMPERS & SWEATERS",
    "TRACKSUIT SETS",
    "LEGGINGS",
    "GLOVES",
    "VESTS & BRAS",
  ],
  ACCESSORIES: [
    "BALLS",
    "BAGS & HOLDALLS",
    "HEADWEAR",
    "GLOVES",
    "RACKETS & BATS",
    "SPORTS TOWELS",
    "PROTECTIVE GEAR",
    "SUNGLASSES",
    "WATCHES MONITORS",
    "GYM EQUIPMENT",
    "TOWELS",
  ],
  BRANDS: [
    "ADIDAS",
    "UNDER ARMOUR",
    "REEBOK",
    "PUMA",
    "CASTORE",
    "NIKE",
    "MOLTEN",
    "GUNN & MOORE",
    "UNICORN",
    "UHLSPORT",
    "NEW BALANCE",
  ],
  SPORTS: [
    "FOOTBALL",
    "RUGBY",
    "CRICKET",
    "ATHLETICS",
    "SWIMMING",
    "BASKETBALL",
    "HOCKEY",
    "TENNIS",
    "BADMINTON",
    "SQUASH",
    "PADEL",
    "TABLE TENNIS",
    "CYCLING",
    "BOXING / MARTIAL ARTS",
    "SKIING / SNOWBOARDING",
    "YOGA / FITNESS",
    "SNOOKER / POOL",
    "DARTS",
  ],
};

export function formatTaxonomyLabel(value) {
  const upper = String(value || "").trim().toUpperCase();
  if (!upper) return "";
  if (LABEL_OVERRIDES[upper]) return LABEL_OVERRIDES[upper];

  return upper
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (!word) return "";
      if (index > 0 && TITLE_CASE_EXCEPTIONS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function getCategoryHref(categoryName) {
  const normalized = String(categoryName || "").trim().toUpperCase();
  if (normalized === "HOME") return "/";
  if (normalized === "BRANDS") return "/products";
  if (normalized === "UNDER £5") return "/under-5";
  return `/products?category=${encodeURIComponent(categoryName)}`;
}

export function getSubcategoryHref(categoryName, subcategoryName) {
  const normalizedCategory = String(categoryName || "").trim().toUpperCase();
  if (normalizedCategory === "BRANDS") {
    return `/products?brand=${encodeURIComponent(subcategoryName)}`;
  }
  if (normalizedCategory === "SPORTS") {
    return `/products?category=SPORTS&subcategory=${encodeURIComponent(subcategoryName)}`;
  }
  return `/products?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(subcategoryName)}`;
}

/* Authoritative top-level nav group order.
   Only categories whose uppercase name appears here will show in the navbar.
   Anything else in the DB (raw product-level categories) is silently excluded.
*/
const TOP_LEVEL_NAV_ORDER = [
  "FOOTWEAR",
  "CLOTHING",
  "LICENSED TEAM CLOTHING",
  "ACCESSORIES",
  "BRANDS",
  "SPORTS",
  "B GRADE",
  "JOB LOTS",
];

export function getNavigableCategories(categories = []) {
  const map = new Map();
  for (const cat of categories) {
    map.set(String(cat?.name || "").toUpperCase(), cat);
  }

  return TOP_LEVEL_NAV_ORDER.map((key) => {
    const fromApi = map.get(key);
    if (!fromApi) {
      const fallbackSubs = NAV_SUBCATEGORY_FALLBACKS[key] || [];
      return {
        name: key,
        subcategories: fallbackSubs.map((name) => ({ name })),
      };
    }

    const apiSubcategories = Array.isArray(fromApi.subcategories)
      ? fromApi.subcategories
      : [];

    if (apiSubcategories.length > 0) {
      return fromApi;
    }

    const fallbackSubs = NAV_SUBCATEGORY_FALLBACKS[key] || [];
    if (fallbackSubs.length === 0) {
      return fromApi;
    }

    return {
      ...fromApi,
      subcategories: fallbackSubs.map((name) => ({ name })),
    };
  });
}

export function getFilterableCategories(categories = []) {
  return getNavigableCategories(categories).filter((category) => {
    const name = String(category?.name || "").toUpperCase();
    return name !== "BRANDS";
  });
}