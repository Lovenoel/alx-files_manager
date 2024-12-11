import redisClient from "../utils/redis";
import dbClient from "../utils/db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const credentials = Buffer.from(
      authHeader.split(" ")[1],
      "base64"
    ).toString();
    const [email, password] = credentials.split(":");

    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");
    const user = await dbClient.db
      .collection("users")
      .findOne({ email, password: hashedPassword });

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 86400);

    res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers["x-token"];
    if (!token || !(await redisClient.get(`auth_${token}`))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await redisClient.del(`auth_${token}`);
    res.status(204).send();
  }
}
export default AuthController;
