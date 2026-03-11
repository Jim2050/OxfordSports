"""Fix ALL empty subcategories for clothing, accessories, and remaining products."""
import re
from pymongo import MongoClient, UpdateOne

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"

client = MongoClient(MONGO_URI)
db = client["Oxford"]
products_col = db["products"]

# ── Category detection ──
FOOTWEAR_MODELS = re.compile(r"\b(SUPERSTAR|STAN SMITH|GAZELLE|SAMBA|CAMPUS|FORUM|NMD|ULTRA\s?BOOST|ULTRABOOST|YEEZY|OZWEEGO|ZX|CONTINENTAL|SUPERNOVA|PURE\s?BOOST|SOLAR\s?BOOST|RESPONSE|ADIZERO|ADISTAR|QUESTAR|DURAMO|GALAXY|RUNFALCON|LITE RACER|SWIFT RUN|MULTIX|NITE JOGGER|RETROPY|OZELIA|OZRAH|RIVALRY|DROPSET|DROPSTEP|STREETBALL|HOOPS|ENTRAP|TENSAUR|FORTARUN|RAPIDARUN|4DFWD|DAME|HARDEN|D\.O\.N\.|TRAE|ADILETTE|CLOUDFOAM)\b", re.I)
FOOTWEAR_STUDS = re.compile(r"\b(FG|SG|AG|TF|FxG|MG|HG|IN|IC|FIRM GROUND|SOFT GROUND|TURF|INDOOR|ARTIFICIAL GROUND|MOULDED)\b", re.I)
FOOTWEAR_KEYWORDS = re.compile(r"\b(SHOE|SHOES|BOOT|BOOTS|TRAINER|TRAINERS|SNEAKER|SNEAKERS|CLEAT|CLEATS|FOOTWEAR|SLIDER|SLIDERS|SLIDE|SANDAL|FLIP FLOP|RUNNING SHOE|FOOTBALL BOOT|RUGBY BOOT|GOLF SHOE|TENNIS SHOE)\b", re.I)
CLOTHING_ABBREVS = re.compile(r"\b(JSY|JKT|SHO|TEE|HD|SWT|BRA|TIGHT|PT|TT)\b", re.I)
CLOTHING_KEYWORDS = re.compile(r"\b(SHIRT|SHORTS|JACKET|HOODIE|HOODY|SWEATSHIRT|SWEATER|JERSEY|T-SHIRT|POLO|VEST|LEGGING|LEGGINGS|TIGHTS|CROP|PANTS|JOGGER|JOGGERS|TRACKSUIT|COAT|PARKA|WINDBREAKER|ANORAK|GILET|GILLET|FLEECE|PULLOVER|CREW|TANK|BIKINI|SWIMSUIT|COSTUME|SKIRT|DRESS|ONESIE|ROMPER|BODYSUIT|TROUSERS|SHORTS|RAINCOAT|TEE SHIRT|TRACK TOP|TRACK PANT)\b", re.I)
ACCESSORIES_KEYWORDS = re.compile(r"\b(BAG|BAGS|BALL|BALLS|TOWEL|TOWELS|BOTTLE|BOTTLES|SHIN|SHIN GUARD|SHIN PAD|SHINGUARD|GLOVE|GLOVES|CAP|CAPS|HAT|HATS|SCARF|SCARVES|BEANIE|BEANIES|HEADBAND|WRISTBAND|ARMBAND|SOCK|SOCKS|ANKLE SOCK|CREW SOCK|PROTECTOR|WATER BOTTLE|GYMSACK|GYM SACK|GYM BAG|BACKPACK|DUFFEL|DUFFLE|RUCKSACK|TEAM BAG|HOLDALL|WASHBAG|KEYRING|LANYARD|PENCIL CASE|WALLET|PURSE|WATCH|SUNGLASSES|BELT|STUD|STUDS|LACE|LACES|INSOLE|SHIN SOCK)\b", re.I)

# ── Old category → new category+subcategory mapping ──
OLD_CAT_MAP = {
    "football shorts": ("CLOTHING", "Shorts"),
    "shorts": ("CLOTHING", "Shorts"),
    "t-shirts": ("CLOTHING", "Shirts"),
    "polo shirts": ("CLOTHING", "Shirts"),
    "football shirts": ("CLOTHING", "Shirts"),
    "vests": ("CLOTHING", "Vests & Bras"),
    "track pants": ("CLOTHING", "Tracksuits & Joggers"),
    "track tops": ("CLOTHING", "Tracksuits & Joggers"),
    "track jackets": ("CLOTHING", "Tracksuits & Joggers"),
    "track and training pants": ("CLOTHING", "Tracksuits & Joggers"),
    "three quarter pants": ("CLOTHING", "Tracksuits & Joggers"),
    "tracksuits": ("CLOTHING", "Tracksuits & Joggers"),
    "trousers": ("CLOTHING", "Tracksuits & Joggers"),
    "hooded sweat": ("CLOTHING", "Hoods & Sweaters"),
    "crew sweat": ("CLOTHING", "Hoods & Sweaters"),
    "fleece": ("CLOTHING", "Hoods & Sweaters"),
    "knitwear": ("CLOTHING", "Hoods & Sweaters"),
    "coats": ("CLOTHING", "Jackets & Coats"),
    "jackets": ("CLOTHING", "Jackets & Coats"),
    "lightweight jackets": ("CLOTHING", "Jackets & Coats"),
    "raincoats": ("CLOTHING", "Jackets & Coats"),
    "gillet": ("CLOTHING", "Jackets & Coats"),
    "bikini": ("CLOTHING", "Swimwear"),
    "swimming costumes": ("CLOTHING", "Swimwear"),
    "swim shorts": ("CLOTHING", "Swimwear"),
    "leggings": ("CLOTHING", "Leggings"),
    "long skirts": ("CLOTHING", "Leggings"),
    "long dresses": ("CLOTHING", "Shirts"),
    "fitness and gym tops": ("CLOTHING", "Shirts"),
    "trainers": ("FOOTWEAR", "Trainers"),
    "running shoes": ("FOOTWEAR", "Trainers"),
    "football boots": ("FOOTWEAR", "Football Boots"),
    "rugby boots": ("FOOTWEAR", "Rugby Boots"),
    "beach shoes": ("FOOTWEAR", "Beach Footwear"),
    "golf shoes": ("FOOTWEAR", "Golf Shoes"),
    "football socks": ("CLOTHING", "Socks & Gloves"),
    "adult's socks": ("CLOTHING", "Socks & Gloves"),
    "football gloves": ("ACCESSORIES", "Gloves"),
    "casual bags": ("ACCESSORIES", "Bags & Holdalls"),
    "peak caps": ("ACCESSORIES", "Headwear"),
    "football accessories": ("ACCESSORIES", "Protective Gear"),
    "assorted accessories": ("ACCESSORIES", "Bags & Holdalls"),
    "mens belts": ("ACCESSORIES", "Bags & Holdalls"),
}

GENDER_ONLY = re.compile(r"^(MENS?|WOMENS?|WOMEN|FEMALE|LADIES|JUNIOR|JUNIORS|KIDS|YOUTH|BOYS?|GIRLS?|UNISEX|INFANT|BABY|TODDLER)$", re.I)

# ── Footwear subcategory rules ──
FOOTBALL_BOOTS_RE = re.compile(r"\b(NEMEZIZ|COPA|PREDATOR|SPEEDFLOW|X SPEEDPORTAL|X CRAZYFAST|PREDSTRIKE|SOCCER SHOE|FOOTBALL BOOT)\b|\b(FG|SG|TF|AG|FxG|MG|HG)\b", re.I)
RUGBY_BOOTS_RE = re.compile(r"\b(RUGBY|KAKARI|MALICE|FLANKER)\b", re.I)
GOLF_SHOES_RE = re.compile(r"\b(GOLF|CODECHAOS|ZG21|TOUR360|S2G|SOLARMOTION|REBELCROSS)\b", re.I)
TENNIS_SHOES_RE = re.compile(r"\b(TENNIS|PADEL|BARRICADE|COURTJAM|SOLEMATCH|GAMECOURT|COURTFLASH|DEFIANT)\b", re.I)
BEACH_RE = re.compile(r"\b(SLIDE|SLIDES|SANDAL|SANDALS|FLIP FLOP|FLIP FLOPS|SHOWER|ADILETTE|COMFORT SLIDE)\b", re.I)
SPECIALIST_RE = re.compile(r"\b(TERREX|HIKING|TRAIL|OUTDOOR|WALKING)\b", re.I)

# Clothing subcategory rules
SHIRTS_RE = re.compile(r"\b(JSY|JERSEY|SHIRT|POLO|TEE|T-SHIRT|T SHIRT|SS TEE|LS TEE|GRAPHIC TEE|TOP|CROP TOP|TANK)\b", re.I)
SHORTS_RE = re.compile(r"\bSHO\b|\b(SHORTS|SHORT)\b", re.I)
JACKETS_RE = re.compile(r"\b(JKT|JACKET|COAT|PARKA|WINDBREAKER|ANORAK|GILLET|GILET|PADDED|BOMBER)\b", re.I)
HOODS_RE = re.compile(r"\b(HOOD|HOODIE|HOODY|SWEAT|SWT|CREW SWEAT|PULLOVER|FLEECE)\b|\bHD\b", re.I)
SOCKS_GLOVES_RE = re.compile(r"\b(SOCK|SOCKS|GLOVE|GLOVES)\b", re.I)
HATS_RE = re.compile(r"\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b", re.I)
TRACKSUITS_RE = re.compile(r"\b(TRACKSUIT|JOGGER|JOGGERS|TRACK PANT|TRACK PANTS|TRG PNT|TRK PNT|PANTS|PES JKT|FIREBIRD)\b|\bPT\b|\bTT\b", re.I)
SWIMWEAR_RE = re.compile(r"\b(SWIM|BIKINI|SWIMMING|SWIM SHORT)\b", re.I)
LEGGINGS_RE = re.compile(r"\b(LEGGING|LEGGINGS|TIGHT|TIGHTS)\b", re.I)
VESTS_RE = re.compile(r"\b(VEST|BRA|BRAS|CROP)\b", re.I)

# Accessories subcategory rules
BALLS_RE = re.compile(r"\b(BALL|BALLS|MATCH BALL|TRAINING BALL)\b", re.I)
BAGS_RE = re.compile(r"\b(BAG|BAGS|BACKPACK|HOLDALL|DUFFEL|RUCKSACK|GYMSACK|GYM SACK|TOTE)\b", re.I)
ACC_HEADWEAR_RE = re.compile(r"\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b", re.I)
ACC_GLOVES_RE = re.compile(r"\b(GLOVE|GLOVES|GOALKEEPER|GK)\b", re.I)
RACKETS_RE = re.compile(r"\b(RACKET|BAT|RACQUET|PADDLE)\b", re.I)
TOWELS_RE = re.compile(r"\b(TOWEL|TOWELS)\b", re.I)
PROTECTIVE_RE = re.compile(r"\b(SHIN|GUARD|GUARDS|PAD|PADS|PROTECTIVE|ANKLE)\b", re.I)
SUNGLASS_RE = re.compile(r"\b(SUNGLASS|SUNGLASSES|EYEWEAR)\b", re.I)
WATCHES_RE = re.compile(r"\b(WATCH|MONITOR|TRACKER|FITNESS BAND)\b", re.I)
ACC_SOCKS_RE = re.compile(r"\b(SOCK|SOCKS)\b", re.I)
BOTTLE_RE = re.compile(r"\b(BOTTLE|WATER)\b", re.I)

TEAM_MAP = {
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
    "IRFU": "Ireland Rugby", "AJAX": "Ajax",
    "CELTIC": "Celtic", "RANGERS": "Rangers", "BENFICA": "Benfica",
    "ARU": "Australia Rugby", "SARU": "South Africa Rugby",
    "NZRU": "New Zealand Rugby", "WALLABIES": "Australia Rugby",
    "SPRINGBOK": "South Africa Rugby",
}
SPORT_MAP = {
    "RUGBY": "Rugby", "FOOTBALL": "Football", "SOCCER": "Football",
    "TENNIS": "Tennis", "GOLF": "Golf", "RUNNING": "Running",
    "BASKETBALL": "Basketball", "CRICKET": "Cricket",
    "HOCKEY": "Hockey", "BOXING": "Boxing",
    "SWIMMING": "Swimming", "GYM": "Training", "TRAINING": "Training",
    "YOGA": "Yoga", "FITNESS": "Training",
}


def detect_category(combined):
    """Detect FOOTWEAR/CLOTHING/ACCESSORIES from product text."""
    if FOOTWEAR_MODELS.search(combined) or FOOTWEAR_STUDS.search(combined) or FOOTWEAR_KEYWORDS.search(combined):
        return "FOOTWEAR"
    if ACCESSORIES_KEYWORDS.search(combined):
        return "ACCESSORIES"
    if CLOTHING_ABBREVS.search(combined) or CLOTHING_KEYWORDS.search(combined):
        return "CLOTHING"
    return "CLOTHING"  # default


def get_subcategory(combined, cat):
    """Get subcategory for a given category."""
    # Footwear
    if cat == "FOOTWEAR":
        if FOOTBALL_BOOTS_RE.search(combined): return "Football Boots"
        if RUGBY_BOOTS_RE.search(combined): return "Rugby Boots"
        if GOLF_SHOES_RE.search(combined): return "Golf Shoes"
        if TENNIS_SHOES_RE.search(combined): return "Tennis / Padel Shoes"
        if BEACH_RE.search(combined): return "Beach Footwear"
        if SPECIALIST_RE.search(combined): return "Specialist Footwear"
        return "Trainers"

    # Clothing
    if cat == "CLOTHING":
        if SHIRTS_RE.search(combined): return "Shirts"
        if SHORTS_RE.search(combined): return "Shorts"
        if JACKETS_RE.search(combined): return "Jackets & Coats"
        if HOODS_RE.search(combined): return "Hoods & Sweaters"
        if SOCKS_GLOVES_RE.search(combined): return "Socks & Gloves"
        if HATS_RE.search(combined): return "Hats & Caps"
        if TRACKSUITS_RE.search(combined): return "Tracksuits & Joggers"
        if SWIMWEAR_RE.search(combined): return "Swimwear"
        if LEGGINGS_RE.search(combined): return "Leggings"
        if VESTS_RE.search(combined): return "Vests & Bras"
        return "Shirts"  # default

    # Accessories
    if cat == "ACCESSORIES":
        if BALLS_RE.search(combined): return "Balls"
        if BAGS_RE.search(combined): return "Bags & Holdalls"
        if ACC_HEADWEAR_RE.search(combined): return "Headwear"
        if ACC_GLOVES_RE.search(combined): return "Gloves"
        if RACKETS_RE.search(combined): return "Rackets & Bats"
        if TOWELS_RE.search(combined): return "Sports Towels"
        if PROTECTIVE_RE.search(combined): return "Protective Gear"
        if SUNGLASS_RE.search(combined): return "Sunglasses"
        if WATCHES_RE.search(combined): return "Watches Monitors"
        if ACC_SOCKS_RE.search(combined): return "Socks & Gloves"
        if BOTTLE_RE.search(combined): return "Bags & Holdalls"
        return None

    return None


# Find ALL products (we'll check each one)
all_products = list(products_col.find(
    {},
    {"_id": 1, "name": 1, "description": 1, "sku": 1, "category": 1, "subcategory": 1}
))
print(f"Total products in DB: {len(all_products)}")

bulk_ops = []
for p in all_products:
    combined = f"{p.get('name', '')} {p.get('description', '')} {p.get('sku', '')}".upper()
    cat = (p.get("category") or "").strip()
    sub = (p.get("subcategory") or "").strip()
    update = {}

    cat_lower = cat.lower()

    # Step 1: Fix category if it's an old/wrong category
    if cat_lower in OLD_CAT_MAP:
        new_cat, new_sub = OLD_CAT_MAP[cat_lower]
        update["category"] = new_cat
        if not sub:
            update["subcategory"] = new_sub
        cat = new_cat  # use for subcategory detection below
    elif GENDER_ONLY.match(cat):
        # Gender-only category → detect from product name
        new_cat = detect_category(combined)
        update["category"] = new_cat
        cat = new_cat
    elif cat.upper() not in ("FOOTWEAR", "CLOTHING", "ACCESSORIES"):
        # Unknown category → detect from product name
        new_cat = detect_category(combined)
        update["category"] = new_cat
        cat = new_cat

    # Step 2: Fix subcategory if empty
    if not sub and "subcategory" not in update:
        cat_upper = cat.upper()
        new_sub = get_subcategory(combined, cat_upper)

        # Try team/sport if no category-specific match
        if not new_sub:
            for key, subcat in TEAM_MAP.items():
                if key in combined:
                    new_sub = subcat
                    break
        if not new_sub:
            for key, subcat in SPORT_MAP.items():
                if re.search(rf"\b{key}\b", combined):
                    new_sub = subcat
                    break

        if new_sub:
            update["subcategory"] = new_sub

    if update:
        bulk_ops.append(UpdateOne({"_id": p["_id"]}, {"$set": update}))

print(f"Will update {len(bulk_ops)} products")

if bulk_ops:
    # Process in batches of 1000
    total_modified = 0
    for i in range(0, len(bulk_ops), 1000):
        batch = bulk_ops[i:i+1000]
        result = products_col.bulk_write(batch, ordered=False)
        total_modified += result.modified_count
        print(f"  Batch {i//1000 + 1}: modified {result.modified_count}")
    print(f"Total modified: {total_modified}")

# Show distribution
pipeline = [
    {"$group": {"_id": {"cat": "$category", "sub": "$subcategory"}, "count": {"$sum": 1}}},
    {"$sort": {"_id.cat": 1, "_id.sub": 1}},
]
stats = list(products_col.aggregate(pipeline))
print("\n=== Full Category/Subcategory Distribution ===")
current_cat = None
for s in stats:
    cat = s["_id"].get("cat", "?")
    sub = s["_id"].get("sub") or "(empty)"
    if cat != current_cat:
        print(f"\n  [{cat}]")
        current_cat = cat
    print(f"    {sub}: {s['count']}")

# Show remaining empty
empty = products_col.count_documents({"$or": [{"subcategory": {"$in": ["", None]}}, {"subcategory": {"$exists": False}}]})
print(f"\nRemaining empty subcategory: {empty}")

# Show non-standard categories
bad_cats = products_col.distinct("category", {"category": {"$nin": ["FOOTWEAR", "CLOTHING", "ACCESSORIES"]}})
print(f"Non-standard categories remaining: {bad_cats}")

client.close()
