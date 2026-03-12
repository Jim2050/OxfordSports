"""Recategorize products with 'B grade' in brand to B GRADE category."""
import re
from pymongo import MongoClient, UpdateOne

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"
B_GRADE_RE = re.compile(r"\bB[\s-]*grade\b", re.IGNORECASE)

client = MongoClient(MONGO_URI)
db = client["Oxford"]
products = db["products"]

all_prods = list(products.find({"brand": B_GRADE_RE}, {"_id": 1, "name": 1, "brand": 1, "category": 1}))
print(f"Found {len(all_prods)} products with B grade in brand")
for p in all_prods[:5]:
    print(f"  {p['name']} | brand={p['brand']} | cat={p.get('category','')}")

ops = []
for p in all_prods:
    clean_brand = B_GRADE_RE.sub("", p.get("brand", "")).strip() or p.get("brand", "")
    ops.append(UpdateOne({"_id": p["_id"]}, {"$set": {"category": "B GRADE", "brand": clean_brand}}))

if ops:
    result = products.bulk_write(ops)
    print(f"Modified: {result.modified_count}")

client.close()
