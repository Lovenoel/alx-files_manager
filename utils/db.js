const { MongoClient } = require('mongodb');
const redisClient = require( './redis');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    this.client = new MongoClient(`mongodb://${host}:${port}`, {
      useUnifiedTopology: true,
    });
    this.client.connect().catch(console.error);

    this.db = this.client.db(database);
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

  async addUser(email, password) {
    return this.db.collection('users').insertOne({ email, password});
  }

  async findUserByEmail(email) {
    return this.db.collection('users').findOne({ email })
  }

  async findUserByToken(token) {
    const userId = await redisClient.get(`auth_${token}`);
    return this.db.collection('users').findOne({ _id: userId});
  }

  async addFile(file) {
    return this.db.collection('files').insertOne(file)
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
