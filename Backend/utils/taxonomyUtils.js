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

function sanitizeSizeLabel(value) {
  return normalizeText(String(value || "").replace(/""/g, '"').replace(/^"|"$/g, ""));
}

function isMalformedSize(size) {
  const normalized = sanitizeSizeLabel(size);
  if (!normalized) return true;
  if (normalized.startsWith("-")) return true;
  return false;
}

function parseSizeEntries(rawSize, fallbackQty) {
  const input = normalizeText(rawSize);
  if (!input) {
    return {
      entries: [],
      invalidTokens: [],
      checksumMismatch: false,
      embeddedQuantities: false,
      parsedTotal: 0,
    };
  }

  const tokens = input
    .split(input.includes(";") ? ";" : ",")
    .map((token) => token.trim())
    .filter(Boolean);

  const entries = [];
  const invalidTokens = [];
  let parsedTotal = 0;
  let embeddedQuantities = false;

  for (const token of tokens) {
    const embeddedMatch = token.match(/^(.*)\((\d+)\)$/);
    const rawLabel = embeddedMatch ? embeddedMatch[1] : token;
    const size = sanitizeSizeLabel(rawLabel);
    const quantity = embeddedMatch
      ? parseInt(embeddedMatch[2], 10)
      : Math.max(0, Number.parseInt(fallbackQty, 10) || 0);

    if (embeddedMatch) {
      embeddedQuantities = true;
    }

    if (isMalformedSize(size) || quantity <= 0) {
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
  };
}

module.exports = {
  TOP_LEVEL_CATEGORIES,
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveGenderCanonical,
  deriveSportCanonical,
  deriveSubcategoryCanonical,
  parseSizeEntries,
  sanitizeSizeLabel,
};