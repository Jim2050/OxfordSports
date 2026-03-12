"""
One-time script: recategorize existing products matching team/jersey/replica
keywords into LICENSED TEAM CLOTHING category.
"""
import re
from pymongo import MongoClient, UpdateOne

MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford"

TEAM_MAP = {
    "FFR": "France Rugby", "WRU": "Wales Rugby", "SRU": "Scotland Rugby",
    "IRFU": "Ireland Rugby", "NZRU": "New Zealand Rugby",
    "SARU": "South Africa Rugby", "ALL BLACKS": "New Zealand Rugby",
    "MUFC": "Manchester United", "AFC": "Arsenal", "ARSENAL": "Arsenal",
    "JUVE": "Juventus", "JUVENTUS": "Juventus",
    "REAL MADRID": "Real Madrid", "BAYERN": "Bayern Munich", "FCB": "Bayern Munich",
    "MANCHESTER UNITED": "Manchester United", "MAN UTD": "Manchester United",
    "CHELSEA": "Chelsea", "CFC": "Chelsea",
    "LIVERPOOL": "Liverpool", "LFC": "Liverpool",
    "TOTTENHAM": "Tottenham", "SPURS": "Tottenham", "THFC": "Tottenham",
    "CELTIC": "Celtic", "RANGERS": "Rangers", "BENFICA": "Benfica", "AJAX": "Ajax",
}

JSY_RE = re.compile(r'\bJSY\b', re.IGNORECASE)
REPLICA_RE = re.compile(r'\bREPLICA\b', re.IGNORECASE)

def main():
    client = MongoClient(MONGO_URI)
    db = client["Oxford"]
    products = db["products"]

    all_prods = list(products.find(
        {"category": {"$ne": "LICENSED TEAM CLOTHING"}},
        {"_id": 1, "name": 1, "description": 1, "sku": 1, "color": 1}
    ))
    print(f"Checking {len(all_prods)} products")

    ops = []
    for p in all_prods:
        combined = f"{p.get('name', '')} {p.get('description', '')} {p.get('sku', '')}".upper()
        color_upper = (p.get("color") or "").upper()
        is_team = False
        team_sub = ""

        for key, subcat in TEAM_MAP.items():
            if key in combined:
                is_team = True
                team_sub = subcat
                break

        if not is_team and JSY_RE.search(combined):
            is_team = True
        if not is_team and REPLICA_RE.search(f"{combined} {color_upper}"):
            is_team = True

        if is_team:
            update = {"category": "LICENSED TEAM CLOTHING"}
            if team_sub:
                update["subcategory"] = team_sub
            ops.append(UpdateOne({"_id": p["_id"]}, {"$set": update}))

    print(f"To recategorize as LICENSED TEAM CLOTHING: {len(ops)}")
    if ops:
        result = products.bulk_write(ops)
        print(f"Modified: {result.modified_count}")

    client.close()

if __name__ == "__main__":
    main()
