const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford';
const DEST_URI = 'mongodb+srv://oxford_admin:Godaddy1971turbs*@cluster0.3nv9ujo.mongodb.net/Oxford';

async function migrate() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const destClient = new MongoClient(DEST_URI);
  
  try {
    console.log('Connecting to source cluster...');
    await sourceClient.connect();
    
    console.log('Connecting to destination cluster...');
    await destClient.connect();
    
    const sourceDb = sourceClient.db('Oxford');
    const destDb = destClient.db('Oxford');
    
    // Get all collections
    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections to migrate`);
    
    for (const collection of collections) {
      const collName = collection.name;
      console.log(`\nMigrating collection: ${collName}`);
      
      const sourceColl = sourceDb.collection(collName);
      const destColl = destDb.collection(collName);
      
      // Clear destination collection
      await destColl.deleteMany({});
      
      // Get all documents
      const docs = await sourceColl.find({}).toArray();
      console.log(`  Found ${docs.length} documents`);
      
      if (docs.length > 0) {
        await destColl.insertMany(docs);
        console.log(`  ✓ Inserted ${docs.length} documents`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sourceClient.close();
    await destClient.close();
  }
}

migrate();
