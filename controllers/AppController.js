const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  /**
   * GET /status
   * Check if Redis and DB are alive
   */
  static async getStatus(req, res) {
    const redisAlive = await redisClient.isAlive();
    const dbAlive = await dbClient.isAlive();

    res.status(200).json({ redis: redisAlive, db: dbAlive });
  }

  /**
   * GET /stats
   * Get the count of users and files in the database
   */
  static async getStats(req, res) {
    const usersCount = await dbClient.nbUsers();
    const filesCount = await dbClient.nbFiles();

    res.status(200).json({ users: usersCount, files: filesCount });
  }
}

module.exports = AppController;
