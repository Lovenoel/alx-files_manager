const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AuthController {
  /**
   * GET /connect
   * Authenticates the user and generates a token
   */
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    // Check for authorization header
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Decode the base64 credentials
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Find the user by email and check password hash
      const user = await dbClient.db.collection('users').findOne({ email });
      if (!user || user.password !== sha1(password)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Generate a token
      const token = uuidv4();

      // Store the token in Redis for 24 hours (86400 seconds)
      await redisClient.set(`auth_${token}`, user._id.toString(), {Ex: 8600,});

      // Respond with the token
      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error during authentication:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /disconnect
   * Signs out the user by deleting the token
   */
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Delete the token from Redis
      await redisClient.del(`auth_${token}`);

      // Respond with no content (204)
      return res.status(204).send();
    } catch (error) {
      console.error('Error during sign out:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
