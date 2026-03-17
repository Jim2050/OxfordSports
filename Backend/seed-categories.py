"""
Category & Subcategory Seeding Script
=======================================
Wipes existing categories/subcategories and seeds from the Excel structure.
Subcategory names are cleaned (gender suffix stripped).

Run: py seed-categories.py [--dry-run]
"""

import sys
from pymongo import MongoClient
import re

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"
DRY_RUN = "--dry-run" in sys.argv

# ── Category structure from WEBSITE_CATEGORIES_YASIR (4).xlsx ──
CATEGORIES = [
    {
        "name": "HOME",
        "displayOrder": 1,
        "subcategories": [],
    },
    {
        "name": "FOOTWEAR",
        "displayOrder": 2,
        "subcategories": [
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
    },
    {
        "name": "CLOTHING",
        "displayOrder": 3,
        "subcategories": [
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
    },
    {
        "name": "LICENSED TEAM CLOTHING",
        "displayOrder": 4,
        "subcategories": [
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
    },
    {
        "name": "ACCESSORIES",
        "displayOrder": 5,
        "subcategories": [
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
    },
    {
        "name": "B GRADE",
        "displayOrder": 6,
        "subcategories": [],
    },
    {
        "name": "JOB LOTS",
        "displayOrder": 7,
        "subcategories": [],
    },
    {
        "name": "UNDER £5",
        "displayOrder": 8,
        "subcategories": [],
    },
    {
        "name": "BRANDS",
        "displayOrder": 9,
        "subcategories": [
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
    },
    {
        "name": "SPORTS",
        "displayOrder": 10,
        "subcategories": [
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
    },
]


def slugify(text):
    s = text.lower().strip()
    s = re.sub(r"[£]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s


def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=30000, socketTimeoutMS=30000)
    db = client["Oxford"]
    cat_col = db["categories"]
    sub_col = db["subcategories"]

    print("=" * 60)
    print("CATEGORY SEEDING")
    print("Mode: " + ("DRY RUN" if DRY_RUN else "*** LIVE ***"))
    print("=" * 60)

    # Current state
    old_cats = cat_col.count_documents({})
    old_subs = sub_col.count_documents({})
    print("Existing categories:    " + str(old_cats))
    print("Existing subcategories: " + str(old_subs))

    # Wipe
    if not DRY_RUN:
        cat_col.delete_many({})
        sub_col.delete_many({})
    print("Wiped existing categories & subcategories.")

    # Seed
    total_cats = 0
    total_subs = 0

    for cat_def in CATEGORIES:
        cat_doc = {
            "name": cat_def["name"],
            "slug": slugify(cat_def["name"]),
            "description": "",
            "imageUrl": "",
            "displayOrder": cat_def["displayOrder"],
            "isActive": True,
        }

        if not DRY_RUN:
            result = cat_col.insert_one(cat_doc)
            cat_id = result.inserted_id
        else:
            cat_id = "dry-run-id"

        total_cats += 1
        print("  [CAT] " + cat_def["name"] + " (" + str(len(cat_def["subcategories"])) + " subs)")

        for sub_name in cat_def["subcategories"]:
            sub_doc = {
                "name": sub_name,
                "slug": slugify(sub_name),
                "category": cat_id,
                "description": "",
                "imageUrl": "",
                "isActive": True,
            }
            if not DRY_RUN:
                sub_col.insert_one(sub_doc)
            total_subs += 1

    print("")
    print("=" * 60)
    print("RESULTS" + (" (DRY RUN)" if DRY_RUN else ""))
    print("=" * 60)
    print("Categories created:    " + str(total_cats))
    print("Subcategories created: " + str(total_subs))

    if not DRY_RUN:
        print("Final categories:      " + str(cat_col.count_documents({})))
        print("Final subcategories:   " + str(sub_col.count_documents({})))

    client.close()
    print("Done!")


if __name__ == "__main__":
    main()
