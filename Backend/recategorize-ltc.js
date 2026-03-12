/**
 * One-time script: recategorize existing products matching team/jersey/replica
 * keywords into LICENSED TEAM CLOTHING category.
 */
const mongoose = require("mongoose");
const MONGO_URI = "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford";

const TEAM_MAP = {
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
};

async function run() {
  await mongoose.connect(MONGO_URI);
  const P = mongoose.connection.collection("products");

  const all = await P.find(
    { category: { $ne: "LICENSED TEAM CLOTHING" } },
    { projection: { _id: 1, name: 1, description: 1, sku: 1, color: 1 } }
  ).toArray();
  console.log("Checking", all.length, "products");

  const ops = [];
  for (const p of all) {
    const combined = `${p.name || ""} ${p.description || ""} ${p.sku || ""}`.toUpperCase();
    const colorUpper = (p.color || "").toUpperCase();
    let isTeam = false, teamSub = "";

    for (const [key, subcat] of Object.entries(TEAM_MAP)) {
      if (combined.includes(key)) { isTeam = true; teamSub = subcat; break; }
    }
    if (!isTeam && /\bJSY\b/.test(combined)) isTeam = true;
    if (!isTeam && /\bREPLICA\b/.test(`${combined} ${colorUpper}`)) isTeam = true;

    if (isTeam) {
      const update = { category: "LICENSED TEAM CLOTHING" };
      if (teamSub) update.subcategory = teamSub;
      ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: update } } });
    }
  }

  console.log("To recategorize as LICENSED TEAM CLOTHING:", ops.length);
  if (ops.length > 0) {
    const result = await P.bulkWrite(ops);
    console.log("Modified:", result.modifiedCount);
  }
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
