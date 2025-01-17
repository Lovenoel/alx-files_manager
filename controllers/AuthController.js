const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  /**
   * Signs in the user by validating credentials and generating an auth token.
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   * @returns {Object} Response with token or error
   */
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization || '';
    const encodedCredentials = authHeader.split(' ')[1]; // Extract Base64 encoded credentials

    if (!encodedCredentials) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
      const [email, password] = decodedCredentials.split(':');

      if (!email || !password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hashedPassword = sha1(password);
      const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = uuidv4(); // Generate a new auth token
      const tokenKey = `auth_${token}`;

      // Store token in Redis for 24 hours
      await redisClient.set(tokenKey, user._id.toString(), 24 * 60 * 60);

      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error in getConnect:', error.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Signs out the user by removing their auth token.
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   * @returns {Object} Response with no content or error
   */
  static async getDisconnect(req, res) {
    const token = req.headers['x-token']; // Extract token from headers

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const tokenKey = `auth_${token}`;
      const userId = await redisClient.get(tokenKey);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(tokenKey); // Delete the token from Redis
      return res.status(204).send(); // No content response
    } catch (error) {
      console.error('Error in getDisconnect:', error.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
