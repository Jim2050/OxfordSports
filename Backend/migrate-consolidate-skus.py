"""
SKU Consolidation Migration Script (Idempotent, Batched)
=========================================================
Merges child SKU products (12-13 char SKUs like IF6180GRY122)
into parent products (6 char SKUs like IF6180).

Safe to re-run: skips groups that have already been fully processed.
Uses batched delete_many with small batches (20 IDs) for Atlas compat.

Run: py migrate-consolidate-skus.py [--dry-run]
"""

import sys
import time
from collections import defaultdict
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"
DRY_RUN = "--dry-run" in sys.argv
BATCH_SIZE = 20  # Delete this many at a time

def sort_key(s):
    try:
        return (0, float(s))
    except ValueError:
        return (1, s)

def safe_delete_batch(col, ids, retries=3):
    """Delete a batch of IDs with retry logic."""
    for attempt in range(retries):
        try:
            result = col.delete_many({"_id": {"$in": ids}})
            return result.deleted_count
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                print("  WARNING: Failed to delete batch after " + str(retries) + " attempts: " + str(e))
                return 0

def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=60000, socketTimeoutMS=60000, connectTimeoutMS=60000)
    db = client["Oxford"]
    col = db["products"]

    print("=" * 60)
    print("SKU CONSOLIDATION MIGRATION (idempotent)")
    print("Mode: " + ("DRY RUN" if DRY_RUN else "*** LIVE ***"))
    print("=" * 60)

    # Fetch all products
    all_products = list(col.find({}))
    print("Total products in DB: " + str(len(all_products)))

    short_map = {}
    long_list = []
    for p in all_products:
        sku = p.get("sku", "")
        if len(sku) <= 8:
            short_map[sku] = p
        else:
            long_list.append(p)

    print("Short SKUs: " + str(len(short_map)))
    print("Long SKUs: " + str(len(long_list)))

    if not long_list:
        print("No long SKUs remaining - migration already complete!")
        client.close()
        return

    # Group long by parent (first 6 chars)
    child_groups = defaultdict(list)
    for p in long_list:
        parent_code = p["sku"][:6].upper()
        child_groups[parent_code].append(p)

    print("Parent groups to process: " + str(len(child_groups)))
    print("")

    created = 0
    merged = 0
    deleted = 0
    processed = 0
    all_child_ids_to_delete = []

    # Phase 1: Create/merge parents
    for parent_code, children in sorted(child_groups.items()):
        processed += 1
        if processed % 200 == 0:
            print("  Phase 1 ... " + str(processed) + "/" + str(len(child_groups)))

        merged_sizes = {}
        first_child = children[0]
        best = {
            "name": first_child.get("name", ""),
            "brand": first_child.get("brand", ""),
            "category": first_child.get("category", ""),
            "subcategory": first_child.get("subcategory", ""),
            "color": first_child.get("color", ""),
            "rrp": first_child.get("rrp", 0),
            "salePrice": first_child.get("salePrice", 0),
            "imageUrl": first_child.get("imageUrl", ""),
            "barcode": first_child.get("barcode", ""),
            "description": first_child.get("description", ""),
            "sheetName": first_child.get("sheetName", ""),
        }

        for child in children:
            for key in ["brand", "imageUrl", "description"]:
                if not best[key] and child.get(key):
                    best[key] = child[key]
            for sz in child.get("sizes", []):
                sl = str(sz.get("size", "")).strip()
                qty = int(sz.get("quantity", 0))
                if sl:
                    merged_sizes[sl] = merged_sizes.get(sl, 0) + qty

        sizes_array = [
            {"size": s, "quantity": merged_sizes[s]}
            for s in sorted(merged_sizes.keys(), key=sort_key)
        ]
        total_qty = sum(s["quantity"] for s in sizes_array)

        existing = short_map.get(parent_code) or col.find_one({"sku": parent_code})

        if existing:
            existing_sizes = {}
            for sz in existing.get("sizes", []):
                sl = str(sz.get("size", "")).strip()
                eq = int(sz.get("quantity", 0))
                if sl:
                    existing_sizes[sl] = eq

            for s_label, s_qty in merged_sizes.items():
                existing_sizes[s_label] = existing_sizes.get(s_label, 0) + s_qty

            final_sizes = [
                {"size": s, "quantity": existing_sizes[s]}
                for s in sorted(existing_sizes.keys(), key=sort_key)
            ]
            final_total = sum(s["quantity"] for s in final_sizes)

            if not DRY_RUN:
                col.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "sizes": final_sizes,
                        "totalQuantity": final_total,
                        "brand": best["brand"] or existing.get("brand", ""),
                        "imageUrl": best["imageUrl"] or existing.get("imageUrl", ""),
                    }}
                )
            merged += 1
        else:
            parent_doc = {
                "sku": parent_code,
                "name": best["name"],
                "brand": best["brand"],
                "category": best["category"],
                "subcategory": best["subcategory"],
                "color": best["color"],
                "barcode": best["barcode"],
                "description": best["description"],
                "salePrice": best["salePrice"],
                "rrp": best["rrp"],
                "imageUrl": best["imageUrl"],
                "imagePublicId": "",
                "sheetName": best["sheetName"],
                "sizes": sizes_array,
                "totalQuantity": total_qty,
                "isActive": True,
            }
            if not DRY_RUN:
                col.insert_one(parent_doc)
            created += 1

        # Collect child IDs for bulk deletion
        for child in children:
            all_child_ids_to_delete.append(child["_id"])

    print("")
    print("Phase 1 complete: created=" + str(created) + ", merged=" + str(merged))
    print("Phase 2: Deleting " + str(len(all_child_ids_to_delete)) + " child products in batches of " + str(BATCH_SIZE))

    # Phase 2: Delete children in small batches
    batch_num = 0
    for i in range(0, len(all_child_ids_to_delete), BATCH_SIZE):
        batch = all_child_ids_to_delete[i:i + BATCH_SIZE]
        batch_num += 1
        if not DRY_RUN:
            count = safe_delete_batch(col, batch)
            deleted += count
        else:
            deleted += len(batch)
        if batch_num % 50 == 0:
            print("  Phase 2 ... batch " + str(batch_num) + ", deleted so far: " + str(deleted))

    print("")
    print("=" * 60)
    print("RESULTS" + (" (DRY RUN)" if DRY_RUN else ""))
    print("=" * 60)
    print("Parents created (new):     " + str(created))
    print("Parents merged (existing): " + str(merged))
    print("Children deleted:          " + str(deleted))

    if not DRY_RUN:
        final_count = col.count_documents({})
        print("Final product count:       " + str(final_count))

    client.close()
    print("Done!")

if __name__ == "__main__":
    main()
