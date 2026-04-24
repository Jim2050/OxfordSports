const TOP_LEVEL_CATEGORIES = new Set([
  "HOME",
  "FOOTWEAR",
  "CLOTHING",
  "LICENSED TEAM CLOTHING",
  "ACCESSORIES",
  "B GRADE",
  "JOB LOTS",
  "UNDER £5",
  "BRANDS",
  "SPORTS",
]);

const CATEGORY_ALIASES = new Map([
  ["B GRADE", "B GRADE"],
  ["B-GRADE", "B GRADE"],
  ["B GRADE ", "B GRADE"],
  ["JOB LOT", "JOB LOTS"],
  ["JOB LOTS", "JOB LOTS"],
  ["UNDER 5", "UNDER £5"],
  ["UNDER £5", "UNDER £5"],
  ["LICENSED TEAM CLOTHING", "LICENSED TEAM CLOTHING"],
  ["ACCESSORIES", "ACCESSORIES"],
  ["CLOTHING", "CLOTHING"],
  ["FOOTWEAR", "FOOTWEAR"],
  ["SPORTS", "SPORTS"],
  ["BRANDS", "BRANDS"],
  ["HOME", "HOME"],
]);

const SUBCATEGORY_ALIASES_BY_CATEGORY = {
  FOOTWEAR: new Map([
    ["BEACH FOOTWEAR", "SLIDES, FLIP FLOPS & SANDALS"],
    ["TENNIS / PADEL SHOES", "TENNIS / PADEL & RACKET SPORT SHOES"],
  ]),
  CLOTHING: new Map([
    ["TRACKSUIT JACKETS", "TRACKSUITS JACKETS"],
  ]),
  "LICENSED TEAM CLOTHING": new Map([
    ["JACKETS", "JACKETS & COATS"],
    ["HATS & CAPS", "HEADWEAR"],
    ["ACCESSORIES", "ACCESSORIES & MEMORABILIA"],
  ]),
};

const GENDER_ALIASES = new Map([
  ["MEN", "MENS"],
  ["MENS", "MENS"],
  ["MEN'S", "MENS"],
  ["MALE", "MENS"],
  ["ADULT", "MENS"],
  ["WOMEN", "WOMENS"],
  ["WOMENS", "WOMENS"],
  ["WOMAN", "WOMENS"],
  ["WOMEN'S", "WOMENS"],
  ["LADIES", "WOMENS"],
  ["FEMALE", "WOMENS"],
  ["KIDS", "JUNIOR"],
  ["KID", "JUNIOR"],
  ["JUNIOR", "JUNIOR"],
  ["JUNIORS", "JUNIOR"],
  ["YOUTH", "JUNIOR"],
  ["BOYS", "JUNIOR"],
  ["GIRLS", "JUNIOR"],
  ["INFANT", "JUNIOR"],
  ["BABY", "JUNIOR"],
  ["TODDLER", "JUNIOR"],
  ["UNISEX", "UNISEX"],
]);

const SPORT_KEYWORDS = new Map([
  ["FOOTBALL", ["football", "soccer", "boot", "boots", "fg", "sg", "tf", "ag", "predator", "copa", "nemeziz"]],
  ["RUGBY", ["rugby", "kakari", "malice", "flanker"]],
  ["CRICKET", ["cricket"]],
  ["ATHLETICS", ["athletics"]],
  ["SWIMMING", ["swim", "swimming"]],
  ["BASKETBALL", ["basketball", "harden", "dame", "donovan", "trae"]],
  ["HOCKEY", ["hockey"]],
  ["TENNIS", ["tennis"]],
  ["BADMINTON", ["badminton"]],
  ["SQUASH", ["squash"]],
  ["PADEL", ["padel"]],
  ["TABLE TENNIS", ["table tennis", "ping pong"]],
  ["CYCLING", ["cycling", "cycle", "bike"]],
  ["BOXING / MARTIAL ARTS", ["boxing", "martial arts", "mma"]],
  ["SKIING / SNOWBOARDING", ["ski", "skiing", "snowboard", "snowboarding"]],
  ["YOGA / FITNESS", ["yoga", "fitness", "gym", "training"]],
  ["SNOOKER / POOL", ["snooker", "pool"]],
  ["DARTS", ["darts"]],
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function deriveCategoryCanonical(value) {
  const upper = normalizeUpper(value);
  if (!upper) return "";
  const aliased = CATEGORY_ALIASES.get(upper) || upper;
  return TOP_LEVEL_CATEGORIES.has(aliased) ? aliased : "";
}

function deriveSubcategoryCanonical(category, subcategory) {
  const rawSubcategory = normalizeUpper(subcategory);
  if (!rawSubcategory) return "";
  const rawCategory = deriveCategoryCanonical(category) || normalizeUpper(category);
  const categoryAliases = SUBCATEGORY_ALIASES_BY_CATEGORY[rawCategory];
  if (categoryAliases && categoryAliases.has(rawSubcategory)) {
    return categoryAliases.get(rawSubcategory);
  }
  return rawSubcategory;
}

function deriveBrandCanonical(brand) {
  return normalizeUpper(brand);
}

function deriveGenderCanonical({
  rawGender,
  sku,
  name,
  description,
  category,
  subcategory,
  sizes,
  hadNegativeSizes,
}) {
  const explicit = normalizeUpper(rawGender);
  if (explicit && GENDER_ALIASES.has(explicit)) {
    return GENDER_ALIASES.get(explicit);
  }

  const searchable = normalizeUpper(
    `${name || ""} ${description || ""} ${category || ""} ${subcategory || ""}`,
  );
  for (const [alias, canonical] of GENDER_ALIASES.entries()) {
    if (searchable.includes(alias)) {
      return canonical;
    }
  }

  const upperSku = normalizeUpper(sku);
  if (/W$/.test(upperSku)) return "WOMENS";
  if (/J$/.test(upperSku)) return "JUNIOR";

  if (/\bJRS\b|\bJR\b|\bKIDS\b|\bYOUTH\b|\bINFANT\b|\bBABY\b/.test(searchable)) {
    return "JUNIOR";
  }
  if (/\bW\b|\bWMNS\b|\bWOMENS\b|\bWOMEN'S\b|\bLADIES\b/.test(searchable)) {
    return "WOMENS";
  }

  const categoryUpper = normalizeUpper(category);
  const numericSizes = Array.isArray(sizes)
    ? sizes
        .map((entry) => String(entry?.size || "").trim())
        .map((size) => size.match(/^(\d+(?:\.5)?)$/))
        .filter(Boolean)
        .map((match) => Number(match[1]))
    : [];

  if (categoryUpper === "FOOTWEAR" && numericSizes.length > 0) {
    const maxSize = Math.max(...numericSizes);
    if (hadNegativeSizes && maxSize <= 8) return "WOMENS";
    if (maxSize <= 6) return "JUNIOR";
    if (maxSize >= 7) return "MENS";
  }

  // Keep product cards/filter metadata complete when supplier data has no gender clues.
  if (categoryUpper === "FOOTWEAR") {
    return "UNISEX";
  }

  return "";
}

function deriveSportCanonical({ name, description, category, subcategory }) {
  const searchable = normalizeText(
    `${name || ""} ${description || ""} ${category || ""} ${subcategory || ""}`,
  ).toLowerCase();
  for (const [sport, keywords] of SPORT_KEYWORDS.entries()) {
    if (keywords.some((keyword) => searchable.includes(keyword))) {
      return sport;
    }
  }
  return "";
}

const CATEGORY_DISPLAY_ORDER = {
  'HOME': 10,
  'FOOTWEAR': 1,
  'CLOTHING': 2,
  'LICENSED TEAM CLOTHING': 3,
  'ACCESSORIES': 4,
  'B GRADE': 5,
  'JOB LOTS': 6,
  'UNDER £5': 7,
  'BRANDS': 8,
  'SPORTS': 9,
};

function sanitizeSizeLabel(value) {
  return String(value || "").trim();
}

function isMalformedSize(size) {
  return !sanitizeSizeLabel(size);
}

function parseSizeEntries(rawSize, fallbackQty) {
  // Strip Excel text-force wrapper ="..." that our CSV export uses
  let cleaned = String(rawSize || "").trim();
  if (/^="(.*)"$/.test(cleaned)) {
    cleaned = cleaned.slice(2, -1);
  }

  // Detect values that look like Excel date serial numbers (e.g. 38447.00013888889)
  // or negative number corruption (e.g. -920 from "9(20)"). These are NOT valid sizes.
  if (/^-?\d{4,}(\.\d+)?$/.test(cleaned) && !cleaned.includes("(")) {
    return {
      entries: [],
      invalidTokens: [cleaned],
      checksumMismatch: false,
      embeddedQuantities: false,
      parsedTotal: 0,
      hadNegativeSizes: true,
      hadZeroQtyTokens: false,
    };
  }

  const input = normalizeText(cleaned);
  if (!input) {
    return {
      entries: [],
      invalidTokens: [],
      checksumMismatch: false,
      embeddedQuantities: false,
      parsedTotal: 0,
      hadNegativeSizes: false,
      hadZeroQtyTokens: false,
    };
  }

  // Only split by commas/semicolons if the user is explicitly passing embedded quantities like "S(5), M(7)"
  const hasEmbeddedQty = /\(\d+\)/.test(input) || /:\s*\d+/.test(input);
  
  const tokens = hasEmbeddedQty
    ? input.split(input.includes(";") ? ";" : ",").map((token) => token.trim()).filter(Boolean)
    : [input];

  const entries = [];
  const invalidTokens = [];
  let parsedTotal = 0;
  let embeddedQuantities = false;
  let hadNegativeSizes = false;
  let hadZeroQtyTokens = false;

  for (const token of tokens) {
    const embeddedMatch = token.match(/^(.*)\((\d+)\)$/);
    const colonMatch = token.match(/^(.*):\s*(\d+)$/);
    const matched = embeddedMatch || colonMatch;
    
    const rawLabel = matched ? matched[1] : token;
    const size = sanitizeSizeLabel(rawLabel);
    
    const quantityRaw = matched
      ? Number.parseInt(matched[2], 10)
      : Number.parseInt(fallbackQty, 10);
      
    const quantity = Number.isFinite(quantityRaw) ? Math.max(0, quantityRaw) : 0;

    if (matched) {
      embeddedQuantities = true;
    }

    if (quantity <= 0) {
      hadZeroQtyTokens = true;
    }

    if (isMalformedSize(size)) {
      invalidTokens.push(token);
      continue;
    }

    parsedTotal += quantity;
    entries.push({ size, quantity });
  }

  const normalizedFallbackQty = Math.max(0, Number.parseInt(fallbackQty, 10) || 0);
  const checksumMismatch =
    embeddedQuantities && normalizedFallbackQty > 0 && parsedTotal !== normalizedFallbackQty;

  return {
    entries,
    invalidTokens,
    checksumMismatch,
    embeddedQuantities,
    parsedTotal,
    hadNegativeSizes,
    hadZeroQtyTokens,
  };
}

// ═══════════════════════════════════════════════════════════════
//  CATEGORY ERROR HANDLING WITH REGEX
// ═══════════════════════════════════════════════════════════════

const CATEGORY_SPELLING_CORRECTIONS = {
  'FOOTWARE': 'FOOTWEAR',
  'FOOT WEAR': 'FOOTWEAR',
  'FOOTWERE': 'FOOTWEAR',
  'CLOTHE': 'CLOTHING',
  'CLOTHIN': 'CLOTHING',
  'CLOSING': 'CLOTHING',
  'CLOTHS': 'CLOTHING',
  'CLOTHNG': 'CLOTHING',
  'LICENCED TEAM CLOTHING': 'LICENSED TEAM CLOTHING',
  'LICENSED TEAM': 'LICENSED TEAM CLOTHING',
  'TEAM CLOTHING': 'LICENSED TEAM CLOTHING',
  'ACCESORIES': 'ACCESSORIES',
  'ACCESORRIES': 'ACCESSORIES',
  'ACCESSORY': 'ACCESSORIES',
  'ACESSORIES': 'ACCESSORIES',
  'BRANS': 'BRANDS',
  'BRAND': 'BRANDS',
  'SPORT': 'SPORTS',
  'SPORTZ': 'SPORTS',
};

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function fuzzyMatchCategory(input) {
  const knownCategories = ['FOOTWEAR', 'CLOTHING', 'LICENSED TEAM CLOTHING', 'ACCESSORIES', 'BRANDS', 'SPORTS'];
  let bestMatch = null;
  let bestDistance = 3;
  for (const known of knownCategories) {
    const distance = levenshteinDistance(input, known);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = known;
    }
  }
  return bestDistance <= 2 ? bestMatch : null;
}

function normalizeCategoryWithErrorHandling(rawCategory) {
  if (!rawCategory) return null;
  try {
    let normalized = String(rawCategory)
      .trim()
      .replace(/\x00/g, '')
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[–−—]/g, '-')
      .trim()
      .toUpperCase();
    if (!normalized) return null;
    if (CATEGORY_SPELLING_CORRECTIONS[normalized]) {
      return CATEGORY_SPELLING_CORRECTIONS[normalized];
    }
    const fuzzyMatch = fuzzyMatchCategory(normalized);
    if (fuzzyMatch) return fuzzyMatch;
    const knownCategories = ['FOOTWEAR', 'CLOTHING', 'LICENSED TEAM CLOTHING', 'ACCESSORIES', 'BRANDS', 'SPORTS'];
    if (knownCategories.includes(normalized)) return normalized;
    return null;
  } catch (e) {
    console.error(`[CATEGORY] Error:`, e.message);
    return null;
  }
}

function safeExtractCategory(rawCategory) {
  try {
    return normalizeCategoryWithErrorHandling(rawCategory);
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBCATEGORY ERROR HANDLING WITH REGEX
// ═══════════════════════════════════════════════════════════════

const SUBCATEGORY_SPELLING_CORRECTIONS = {
  'TRACKSUIT JACKET': 'TRACKSUIT JACKETS',
  'TRACKSUITS JACKET': 'TRACKSUIT JACKETS',
  'TRACKSUITE JACKETS': 'TRACKSUIT JACKETS',
  'TRACK SUIT JACKETS': 'TRACKSUIT JACKETS',
  'TRACKSUIT SET': 'TRACKSUIT SETS',
  'TRACK SUIT SETS': 'TRACKSUIT SETS',
  'TRACKSUITE SETS': 'TRACKSUIT SETS',
  'SLIDE FLIP FLOPS SANDALS': 'SLIDES / FLIP FLOPS / SANDALS',
  'SLIDES FLIP FLOPS SANDALS': 'SLIDES / FLIP FLOPS / SANDALS',
  'BEACH FOOTWEAR': 'SLIDES / FLIP FLOPS / SANDALS',
  'FOOTBALL BOOT': 'FOOTBALL BOOTS',
  'SOCCER BOOTS': 'FOOTBALL BOOTS',
  'FOOTBALL TRAINER': 'FOOTBALL TRAINERS',
  'SOCCER TRAINERS': 'FOOTBALL TRAINERS',
  'TENNIS PADEL SHOES': 'TENNIS / PADEL SHOES',
  'TENNNIS PADEL SHOES': 'TENNIS / PADEL SHOES',
  'TENNIS/PADEL SHOES': 'TENNIS / PADEL SHOES',
  'TRAINER': 'TRAINERS',
  'SHORT': 'SHORTS',
  'TSHIRT': 'T-SHIRTS',
  'T SHIRT': 'T-SHIRTS',
  'TEE SHIRT': 'T-SHIRTS',
  'VEST BRA': 'VESTS & BRAS',
  'BRA': 'VESTS & BRAS',
  'DRESS BODYSUIT': 'DRESSES & BODYSUITS',
  'DRESS': 'DRESSES & BODYSUITS',
  'BODYSUIT': 'DRESSES & BODYSUITS',
  'JACKET COAT': 'JACKETS & COATS',
  'JACKET': 'JACKETS & COATS',
  'COAT': 'JACKETS & COATS',
  'WINDBREAKER': 'JACKETS & COATS',
  'HOODY': 'HOODED SWEATERS',
  'HOODIE': 'HOODED SWEATERS',
  'SPECIALIST CLOTHE': 'SPECIALIST CLOTHING',
  'SPECIAL CLOTHING': 'SPECIALIST CLOTHING',
  'SWIM WEAR': 'SWIMWEAR',
  'LEGGING': 'LEGGINGS',
  'SOCK': 'SOCKS',
  'FOOTBALL SHIRT': 'SHIRTS',
  'TRACKSUIT BOTTOM': 'TRACKSUIT BOTTOMS',
  'TRACK SUIT BOTTOMS': 'TRACKSUIT BOTTOMS',
  'JOGGER': 'TRACKSUIT BOTTOMS',
  'JOGGERS': 'TRACKSUIT BOTTOMS',
  'PANTS': 'TRACKSUIT BOTTOMS',
  'GLOVE': 'GLOVES',
  'GOALKEEPER GLOVES': 'GLOVES',
  'PROTECTIVE EQUIPMENT': 'PROTECTIVE GEAR',
  'SHIN GUARD': 'PROTECTIVE GEAR',
  'HEAD WEAR': 'HEADWEAR',
  'HAT': 'HEADWEAR',
  'CAP': 'HEADWEAR',
  'BEANIE': 'HEADWEAR',
  'TEAM JERSEY': 'TEAM JERSEYS',
  'JERSEY': 'TEAM JERSEYS',
  'TEAM TRACKSUIT BOTTOM': 'TEAM TRACKSUIT BOTTOMS',
  'TEAM SHORT': 'TEAM SHORTS',
};

function normalizeSubcategoryText(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[–−—]/g, '-')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*&\s*/g, ' & ')
    .trim()
    .toUpperCase();
}

function fuzzyMatchSubcategory(input) {
  const normalized = normalizeSubcategoryText(input);
  if (SUBCATEGORY_SPELLING_CORRECTIONS[normalized]) {
    return SUBCATEGORY_SPELLING_CORRECTIONS[normalized];
  }
  let bestMatch = null;
  let bestDistance = 3;
  for (const [key, value] of Object.entries(SUBCATEGORY_SPELLING_CORRECTIONS)) {
    const distance = levenshteinDistance(normalized, key);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = value;
    }
  }
  return bestDistance <= 2 ? bestMatch : null;
}

function normalizeSubcategoryWithErrorHandling(rawSubcategory) {
  if (!rawSubcategory) return null;
  try {
    const normalized = normalizeSubcategoryText(rawSubcategory);
    if (!normalized) return null;
    if (SUBCATEGORY_SPELLING_CORRECTIONS[normalized]) {
      return SUBCATEGORY_SPELLING_CORRECTIONS[normalized];
    }
    const fuzzyMatch = fuzzyMatchSubcategory(rawSubcategory);
    if (fuzzyMatch) return fuzzyMatch;
    return normalized;
  } catch (err) {
    console.error(`[SUBCATEGORY] Error:`, err.message);
    return String(rawSubcategory).toUpperCase().trim();
  }
}

function safeExtractSubcategory(rawSubcategory) {
  try {
    return normalizeSubcategoryWithErrorHandling(rawSubcategory);
  } catch (e) {
    return null;
  }
}

module.exports = {
  TOP_LEVEL_CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveGenderCanonical,
  deriveSportCanonical,
  deriveSubcategoryCanonical,
  parseSizeEntries,
  sanitizeSizeLabel,
  normalizeCategoryWithErrorHandling,
  safeExtractCategory,
  normalizeSubcategoryWithErrorHandling,
  safeExtractSubcategory,
  CATEGORY_SPELLING_CORRECTIONS,
  SUBCATEGORY_SPELLING_CORRECTIONS,
  levenshteinDistance,
};