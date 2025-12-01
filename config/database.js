// Database connection and collection access
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.nbmsclf.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db = null;
let isConnected = false;

async function connectDB() {
  if (isConnected && db) {
    return db;
  }

  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'knowledgetrace');
    isConnected = true;
    console.log('Successfully connected to MongoDB!');
    
    // Create indexes for better query performance
    try {
      const usersCollection = getUsersCollection();
      const projectsCollection = getProjectsCollection();
      
      // Indexes for users collection
      await usersCollection.createIndex({ uid: 1 }, { unique: true });
      await usersCollection.createIndex({ email: 1 });
      await usersCollection.createIndex({ isAdmin: 1 });
      
      // Indexes for projects collection
      await projectsCollection.createIndex({ authorId: 1 });
      await projectsCollection.createIndex({ status: 1 });
      await projectsCollection.createIndex({ year: 1 });
      await projectsCollection.createIndex({ createdAt: -1 });
      await projectsCollection.createIndex({ title: 'text', abstract: 'text', tags: 'text' }); // Text search index
      
      console.log('Database indexes created successfully!');
    } catch (indexError) {
      console.warn('Error creating indexes (may already exist):', indexError.message);
    }
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

function getUsersCollection() {
  return getDB().collection('users');
}

function getProjectsCollection() {
  return getDB().collection('projects');
}

module.exports = {
  connectDB,
  getDB,
  getUsersCollection,
  getProjectsCollection,
  ObjectId,
};

