/**
 * One-time script to fix ALL empty subcategories (clothing + accessories + remaining)
 * Runs directly against production MongoDB
 */
const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const Product = mongoose.connection.collection("products");

  // ── Regex rules ──
  const FOOTBALL_BOOTS_RE = /\b(NEMEZIZ|COPA|PREDATOR|SPEEDFLOW|X SPEEDPORTAL|X CRAZYFAST|PREDSTRIKE|SOCCER SHOE|FOOTBALL BOOT)\b|\b(FG|SG|TF|AG|FxG|MG|HG)\b/i;
  const RUGBY_BOOTS_RE = /\b(RUGBY|KAKARI|MALICE|FLANKER)\b/i;
  const GOLF_SHOES_RE = /\b(GOLF|CODECHAOS|ZG21|TOUR360|S2G|SOLARMOTION|REBELCROSS)\b/i;
  const TENNIS_SHOES_RE = /\b(TENNIS|PADEL|BARRICADE|COURTJAM|SOLEMATCH|GAMECOURT|COURTFLASH|DEFIANT)\b/i;
  const BEACH_RE = /\b(SLIDE|SLIDES|SANDAL|SANDALS|FLIP FLOP|FLIP FLOPS|SHOWER|ADILETTE|COMFORT SLIDE)\b/i;
  const SPECIALIST_RE = /\b(TERREX|HIKING|TRAIL|OUTDOOR|WALKING)\b/i;

  const TEAM_MAP = {
    "MUFC": "Manchester United", "MAN UTD": "Manchester United",
    "AFC": "Arsenal", "ARSENAL": "Arsenal",
    "CFC": "Chelsea", "CHELSEA": "Chelsea",
    "LFC": "Liverpool", "LIVERPOOL": "Liverpool",
    "MCFC": "Manchester City", "MAN CITY": "Manchester City",
    "THFC": "Tottenham", "SPURS": "Tottenham",
    "LCFC": "Leicester", "NUFC": "Newcastle",
    "LUFC": "Leeds", "WHUFC": "West Ham",
    "REAL MADRID": "Real Madrid", "BAYERN": "Bayern Munich",
    "JUVENTUS": "Juventus", "JUVE": "Juventus",
    "ALL BLACKS": "New Zealand Rugby", "FFR": "France Rugby",
    "WRU": "Wales Rugby", "SRU": "Scotland Rugby",
    "IRFU": "Ireland Rugby",
  };
  const SPORT_MAP = {
    "RUGBY": "Rugby", "FOOTBALL": "Football", "SOCCER": "Football",
    "TENNIS": "Tennis", "GOLF": "Golf", "RUNNING": "Running",
    "BASKETBALL": "Basketball", "CRICKET": "Cricket",
    "HOCKEY": "Hockey", "BOXING": "Boxing",
    "SWIMMING": "Swimming", "GYM": "Training", "TRAINING": "Training",
    "YOGA": "Yoga", "FITNESS": "Training",
  };

  // Find all products with empty/null/bad subcategory
  const products = await Product.find(
    { $or: [
      { subcategory: { $in: ["", null] } },
      { subcategory: "Footwear" },
      { subcategory: "Rugby" },
      { subcategory: { $exists: false } },
    ]},
    { projection: { _id: 1, name: 1, description: 1, sku: 1, category: 1, subcategory: 1 } }
  ).toArray();

  console.log(`Found ${products.length} products to fix`);

  let updated = 0;
  const bulkOps = [];

  for (const p of products) {
    const combined = `${p.name || ""} ${p.description || ""} ${p.sku || ""}`.toUpperCase();
    const catUpper = (p.category || "").toUpperCase();
    let sub = "";

    // Footwear
    if (catUpper === "FOOTWEAR") {
      if (FOOTBALL_BOOTS_RE.test(combined)) sub = "Football Boots";
      else if (RUGBY_BOOTS_RE.test(combined)) sub = "Rugby Boots";
      else if (GOLF_SHOES_RE.test(combined)) sub = "Golf Shoes";
      else if (TENNIS_SHOES_RE.test(combined)) sub = "Tennis / Padel Shoes";
      else if (BEACH_RE.test(combined)) sub = "Beach Footwear";
      else if (SPECIALIST_RE.test(combined)) sub = "Specialist Footwear";
      else sub = "Trainers";
    }

    // Clothing
    if (!sub && catUpper === "CLOTHING") {
      if (/\b(JSY|JERSEY|SHIRT|POLO|TEE|T-SHIRT|T SHIRT|SS TEE|LS TEE|GRAPHIC TEE|TOP|CROP TOP|TANK)\b/.test(combined)) sub = "Shirts";
      else if (/\bSHO\b|\b(SHORTS|SHORT)\b/.test(combined)) sub = "Shorts";
      else if (/\b(JKT|JACKET|COAT|PARKA|WINDBREAKER|ANORAK|GILLET|GILET|PADDED|BOMBER)\b/.test(combined)) sub = "Jackets & Coats";
      else if (/\b(HOOD|HOODIE|HOODY|SWEAT|SWT|CREW SWEAT|PULLOVER|FLEECE)\b|\bHD\b/.test(combined)) sub = "Hoods & Sweaters";
      else if (/\b(SOCK|SOCKS|GLOVE|GLOVES)\b/.test(combined)) sub = "Socks & Gloves";
      else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) sub = "Hats & Caps";
      else if (/\b(TRACKSUIT|JOGGER|JOGGERS|TRACK PANT|TRACK PANTS|TRG PNT|TRK PNT|PANTS|PES JKT|FIREBIRD)\b|\bPT\b|\bTT\b/.test(combined)) sub = "Tracksuits & Joggers";
      else if (/\b(SWIM|BIKINI|SWIMMING|SWIM SHORT)\b/.test(combined)) sub = "Swimwear";
      else if (/\b(LEGGING|LEGGINGS|TIGHT|TIGHTS)\b/.test(combined)) sub = "Leggings";
      else if (/\b(VEST|BRA|BRAS|CROP)\b/.test(combined)) sub = "Vests & Bras";
      else sub = "Shirts"; // default clothing
    }

    // Accessories
    if (!sub && catUpper === "ACCESSORIES") {
      if (/\b(BALL|BALLS|MATCH BALL|TRAINING BALL)\b/.test(combined)) sub = "Balls";
      else if (/\b(BAG|BAGS|BACKPACK|HOLDALL|DUFFEL|RUCKSACK|GYMSACK|GYM SACK|TOTE)\b/.test(combined)) sub = "Bags & Holdalls";
      else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) sub = "Headwear";
      else if (/\b(GLOVE|GLOVES|GOALKEEPER|GK)\b/.test(combined)) sub = "Gloves";
      else if (/\b(RACKET|BAT|RACQUET|PADDLE)\b/.test(combined)) sub = "Rackets & Bats";
      else if (/\b(TOWEL|TOWELS)\b/.test(combined)) sub = "Sports Towels";
      else if (/\b(SHIN|GUARD|GUARDS|PAD|PADS|PROTECTIVE|ANKLE)\b/.test(combined)) sub = "Protective Gear";
      else if (/\b(SUNGLASS|SUNGLASSES|EYEWEAR)\b/.test(combined)) sub = "Sunglasses";
      else if (/\b(WATCH|MONITOR|TRACKER|FITNESS BAND)\b/.test(combined)) sub = "Watches Monitors";
      else if (/\b(SOCK|SOCKS)\b/.test(combined)) sub = "Socks & Gloves";
      else if (/\b(BOTTLE|WATER)\b/.test(combined)) sub = "Bags & Holdalls";
    }

    // Team
    if (!sub) {
      for (const [key, subcat] of Object.entries(TEAM_MAP)) {
        if (combined.includes(key)) { sub = subcat; break; }
      }
    }

    // Sport
    if (!sub) {
      for (const [key, subcat] of Object.entries(SPORT_MAP)) {
        if (new RegExp(`\\b${key}\\b`).test(combined)) { sub = subcat; break; }
      }
    }

    if (sub) {
      bulkOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { subcategory: sub } },
        },
      });
    }
  }

  console.log(`Will update ${bulkOps.length} products`);

  if (bulkOps.length > 0) {
    const r = await Product.bulkWrite(bulkOps, { ordered: false });
    updated = r.modifiedCount || 0;
  }

  console.log(`Updated: ${updated}`);

  // Show distribution
  const pipeline = [
    { $match: { subcategory: { $nin: ["", null] } } },
    { $group: { _id: { cat: "$category", sub: "$subcategory" }, count: { $sum: 1 } } },
    { $sort: { "_id.cat": 1, "_id.sub": 1 } },
  ];
  const stats = await Product.aggregate(pipeline).toArray();
  console.log("\n=== Subcategory Distribution ===");
  for (const s of stats) {
    console.log(`  ${s._id.cat} → ${s._id.sub}: ${s.count}`);
  }

  // Show remaining empty
  const emptyCount = await Product.countDocuments({ $or: [{ subcategory: { $in: ["", null] } }, { subcategory: { $exists: false } }] });
  console.log(`\nRemaining empty: ${emptyCount}`);

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
