"""
Product Re-categorization Script
==================================
Assigns correct categories & subcategories to products based on name/description
keywords. Products currently have only gender-based categories (MENS/WOMENS/JUNIOR).

Run: py recategorize-products.py [--dry-run]
"""

import sys
import re
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"
DRY_RUN = "--dry-run" in sys.argv

# ── Keyword rules for SUBCATEGORY detection ──
# Order matters: first match wins within a category
FOOTWEAR_RULES = [
    ("FOOTBALL BOOTS", [r"football\s*boot", r"\bfg\b", r"\bsg\b", r"\btf\b", r"\bag\b.*boot", r"\bin\b.*boot", r"soccer\s*boot", r"football.*shoe", r"\bpredator\b", r"\bcopa\b", r"\bx\s*speed", r"\bx\s*crazyfast", r"\baccuracy\b.*boot", r"\bpredstrike\b"]),
    ("RUGBY BOOTS", [r"rugby\s*boot", r"rugby.*shoe", r"\bkakari\b", r"\bmalice\b", r"\brs15\b", r"\brs7\b"]),
    ("GOLF SHOES", [r"golf\s*shoe", r"golf\s*boot", r"\btraxion\b.*golf", r"\bmc\b.*traxion", r"\bcodecrazy\b.*golf", r"\bzg\b.*golf"]),
    ("TENNIS / PADEL SHOES", [r"tennis\s*shoe", r"padel\s*shoe", r"\bbarricade\b", r"\bcourtjam\b", r"\bgamecourt\b"]),
    ("BEACH FOOTWEAR", [r"\bslide\b", r"\bslides\b", r"\bsandal", r"\bflip\s*flop", r"beach.*shoe", r"\badilette\b", r"\bcomfort\s*slide"]),
    ("SPECIALIST FOOTWEAR", [r"\bterrex\b", r"hiking", r"walking\s*shoe", r"outdoor.*shoe", r"climb"]),
    ("TRAINERS", [r"."]),  # Catch-all for remaining footwear
]

CLOTHING_RULES = [
    ("TRACKSUITS & JOGGERS", [r"tracksuit", r"\bjogger", r"track\s*pant", r"track\s*top", r"sweat\s*pant", r"\btrk\b", r"\btt\b", r"\bpt\b", r"pant\b", r"pants\b"]),
    ("JACKETS & COATS", [r"\bjacket\b", r"\bjkt\b", r"\bcoat\b", r"\bparka\b", r"windbreaker", r"\bwb\b", r"rain\s*jacket", r"\bpad\s*jkt\b", r"\bpad\b.*jacket"]),
    ("HOODS & SWEATERS", [r"\bhoodie\b", r"\bhdy\b", r"\bhood\b", r"\bhd\b", r"hooded", r"\bsweater\b", r"sweatshirt", r"\bswt\b", r"\bpullover\b", r"\bcrew\b"]),
    ("SHORTS", [r"\bshort\b", r"\bshorts\b", r"\bsho\b"]),
    ("HATS & CAPS", [r"\bhat\b", r"\bcap\b", r"\bbeanie\b", r"\bbalaclava\b"]),
    ("SOCKS & GLOVES", [r"\bsock\b", r"\bsocks\b"]),
    ("SWIMWEAR", [r"\bswim\b", r"swimwear", r"swimming", r"\bjammer\b"]),
    ("LEGGINGS", [r"\blegging\b", r"\btight\b", r"\btights\b", r"\bcompression\b", r"7/8"]),
    ("VESTS & BRAS", [r"\bvest\b", r"\bbra\b", r"sports?\s*bra", r"\btank\s*top\b", r"\btank\b"]),
    ("SHIRTS", [r"\bshirt\b", r"\btee\b", r"t-shirt", r"\bjsy\b", r"\bjersey\b", r"\bpolo\b", r"\btop\b"]),
]

ACCESSORY_RULES = [
    ("BALLS", [r"\bball\b", r"\bballs\b"]),
    ("BAGS & HOLDALLS", [r"\bbag\b", r"\bbags\b", r"\bholdall\b", r"\bbackpack\b", r"\bduffel\b", r"\brucksack\b"]),
    ("GLOVES", [r"goalkeeper.*glove", r"goal.*glove", r"goalie.*glove", r"gk.*glove", r"batting.*glove", r"keeper.*glove"]),
    ("RACKETS & BATS", [r"\bracket\b", r"\brad\b.*bat", r"\bcricket\s*bat\b"]),
    ("SPORTS TOWELS", [r"\btowel\b"]),
    ("PROTECTIVE GEAR", [r"\bshin\s*guard\b", r"\bguard\b", r"\bshin\s*pad\b", r"\bprotector\b", r"\barmband\b"]),
    ("SUNGLASSES", [r"\bsunglass\b", r"\bsunglasses\b"]),
    ("WATCHES MONITORS", [r"\bwatch\b", r"\bmonitor\b", r"\btracker\b", r"\bfitbit\b"]),
    ("HEADWEAR", [r"\bheadband\b", r"\bsweatband\b", r"\bhair\s*band\b"]),
]

# ── Top-level category detection keywords ──
# Pattern: (category_name, keywords_that_indicate_this_is_footwear/etc)
FOOTWEAR_INDICATORS = [
    r"\bshoe\b", r"\bshoes\b", r"\bboot\b", r"\bboots\b", r"\btrainer\b",
    r"\btrainers\b", r"\bsneaker\b", r"\bsneakers\b", r"\bsandal\b",
    r"\bslide\b", r"\bslides\b", r"\bflip\s*flop", r"\bfootbed\b",
    r"\badilette\b", r"\bslipper\b", r"\bcleat\b", r"\bcleats\b",
    # Boot stud types → strong footwear signal
    r"\bfg\b", r"\bsg\b", r"\btf\b", r"\bag\b", r"\bin\b.*\bboot",
    # Known footwear model keywords
    r"\bultraboost\b", r"\bnmd\b", r"\bsuperstar\b", r"\bstan\s*smith\b",
    r"\bgazelle\b", r"\bsamba\b", r"\bcampus\b", r"\bforum\b",
    r"\bozweego\b", r"\bresponse\b", r"\bduramo\b", r"\bgalaxy\b",
    r"\bpredator\b", r"\bcopa\b", r"\bx\s*speed", r"\badizero\b",
    r"\badifom\b", r"\byeezy\b", r"\bkakari\b", r"\bmalice\b",
    # Running / lifestyle models
    r"\bultimateshow\b", r"\bultimashow\b", r"\brunfalcon\b", r"\bquestar\b",
    r"\bsupernova\b", r"\badistar\b", r"\bsolar\b.*\bglide",
    # Basketball models
    r"\brivalry\b", r"\bhoops\b", r"\btop\s*ten\b", r"\bd\.o\.n\.", r"\bdame\b",
    r"\bharden\b", r"\btrae\b.*\byoung",
    # Retro/classics
    r"\bcontinental\b.*\b80\b", r"\bzx\b\d", r"\bnite\s*jogger\b",
    # Tennis
    r"\bbarricade\b", r"\bcourtjam\b", r"\bgamecourt\b", r"\bcourtflash\b",
    # Outdoor
    r"\bterrex\b",
    # Golf
    r"\btraxion\b", r"\bcodecrazy\b",
]

ACCESSORY_INDICATORS = [
    r"\bball\b", r"\bballs\b", r"\bbag\b", r"\bbags\b", r"\bholdall\b",
    r"\bbackpack\b", r"\bracket\b", r"\btowel\b", r"\bguard\b",
    r"\bsunglass", r"\bwatch\b", r"\bheadband\b", r"\barmband\b",
    r"goalkeeper.*glove", r"goal.*glove",
]

# Clothing abbreviations commonly used by adidas
CLOTHING_ABBREVIATION_INDICATORS = [
    r"\bjkt\b", r"\bsho\b", r"\bsht\b", r"\bpt\b", r"\btt\b",
    r"\bhdy\b", r"\bswt\b", r"\bjsy\b", r"\bwb\b",
    r"\bshirt\b", r"\bshort\b", r"\bshorts\b", r"\bjacket\b",
    r"\bpant\b", r"\bpants\b", r"\bhoodie\b", r"\btee\b",
    r"\bjersey\b", r"\bpolo\b", r"\bsock\b", r"\bsocks\b",
    r"\btight\b", r"\btights\b", r"\blegging\b", r"\bvest\b",
    r"\bbra\b", r"\bcap\b", r"\bhat\b", r"\bbeanie\b",
    r"\btracksuit\b", r"\bjogger\b", r"\bcoat\b",
    r"\bsweater\b", r"\bhoodie\b", r"\bsweatshirt\b",
]


def match_text(text, patterns):
    """Return True if any pattern matches in text."""
    for pat in patterns:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def find_subcategory(text, rules):
    """Find the first matching subcategory from rules list."""
    for sub_name, patterns in rules:
        if match_text(text, patterns):
            return sub_name
    return ""


def categorize_product(product):
    """Determine the best category and subcategory for a product."""
    name = product.get("name", "")
    desc = product.get("description", "")
    text = (name + " " + desc).strip()

    if not text:
        return None, None

    # Priority 1: Check if it's footwear (strongest signal)
    if match_text(text, FOOTWEAR_INDICATORS):
        sub = find_subcategory(text, FOOTWEAR_RULES)
        if not sub:
            sub = "TRAINERS"
        return "FOOTWEAR", sub

    # Priority 2: Check if it's an accessory
    if match_text(text, ACCESSORY_INDICATORS):
        sub = find_subcategory(text, ACCESSORY_RULES)
        return "ACCESSORIES", sub

    # Priority 3: Check if it's explicitly clothing
    if match_text(text, CLOTHING_ABBREVIATION_INDICATORS):
        sub = find_subcategory(text, CLOTHING_RULES)
        return "CLOTHING", sub

    # Default: classify as clothing (most remaining adidas products are apparel)
    sub = find_subcategory(text, CLOTHING_RULES)
    if not sub:
        sub = "SHIRTS"  # Default for unclassifiable clothing
    return "CLOTHING", sub


def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=60000, socketTimeoutMS=120000, connectTimeoutMS=60000)
    db = client["Oxford"]
    col = db["products"]

    print("=" * 60)
    print("PRODUCT RE-CATEGORIZATION")
    print("Mode: " + ("DRY RUN" if DRY_RUN else "*** LIVE ***"))
    print("=" * 60)

    total = col.count_documents({})
    print("Total products: " + str(total))

    products = list(col.find({}, {"_id": 1, "sku": 1, "name": 1, "description": 1, "category": 1, "subcategory": 1, "salePrice": 1}))

    stats = {"FOOTWEAR": 0, "CLOTHING": 0, "ACCESSORIES": 0, "UNDER £5": 0, "uncategorized": 0}
    updated = 0
    skipped = 0

    # Build bulk operations
    from pymongo import UpdateOne
    ops = []
    BATCH_SIZE = 200

    for p in products:
        cat, sub = categorize_product(p)
        if not cat:
            skipped += 1
            continue

        price = p.get("salePrice", 0) or 0
        update = {"category": cat}
        if sub:
            update["subcategory"] = sub

        stats[cat] = stats.get(cat, 0) + 1
        if price > 0 and price <= 5:
            stats["UNDER £5"] += 1

        if not DRY_RUN:
            ops.append(UpdateOne({"_id": p["_id"]}, {"$set": update}))

        updated += 1

        # Flush batch
        if len(ops) >= BATCH_SIZE:
            col.bulk_write(ops, ordered=False)
            print("  Batch flushed: " + str(updated) + " processed")
            ops = []

    # Final flush
    if ops and not DRY_RUN:
        col.bulk_write(ops, ordered=False)

    print("")
    print("=" * 60)
    print("RESULTS" + (" (DRY RUN)" if DRY_RUN else ""))
    print("=" * 60)
    print("Products updated:  " + str(updated))
    print("Products skipped:  " + str(skipped))
    print("")
    print("Category distribution:")
    for cat_name, count in sorted(stats.items()):
        print("  " + cat_name + ": " + str(count))

    # Show some sample categorizations
    print("")
    print("Sample categorizations:")
    import random
    samples = random.sample(products, min(15, len(products)))
    for p in samples:
        cat, sub = categorize_product(p)
        print("  " + (p.get("sku","") or "???") + " | " + (p.get("name","") or "???")[:45] + " -> " + str(cat) + " / " + str(sub))

    client.close()
    print("")
    print("Done!")


if __name__ == "__main__":
    main()
