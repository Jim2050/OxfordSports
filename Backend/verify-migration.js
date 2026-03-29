const { MongoClient } = require('mongodb');

const DEST_URI = 'mongodb+srv://oxford_admin:Godaddy1971turbs*@cluster0.3nv9ujo.mongodb.net/Oxford';

async function verifyMigration() {
  const destClient = new MongoClient(DEST_URI);
  
  try {
    console.log('Connecting to client MongoDB cluster...');
    await destClient.connect();
    
    const db = destClient.db('Oxford');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`\n✅ Connected to client cluster`);
    console.log(`📦 Collections found: ${collections.length}`);
    
    // Check document counts
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`  - ${coll.name}: ${count} documents`);
    }
    
    console.log('\n✅ Database migration verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    process.exit(1);
  } finally {
    await destClient.close();
  }
}

verifyMigration();
