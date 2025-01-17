const mime = require('mime-types');
const imageThumbnail = require('image-thumbnail');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const path = require('path');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
const fileQueue = require('../worker');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
	name,
	type,
	parentId = 0,
	isPublic = false,
	data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    const parent = parentId !== 0 ? await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(parentId) }) : null;
    if (parentId !== 0 && !parent) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    if (parent && parent.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileDocument = {
      userId: dbClient.getObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? '0' : dbClient.getObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({ id: result.insertedId, ...fileDocument });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDocument.localPath = localPath;

    const result = await dbClient.db.collection('files').insertOne(fileDocument);
    return res.status(201).json({ id: result.insertedId, ...fileDocument });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const file = await dbClient.db.collection('files').findOne({ _id: id, userId });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;

    const query = { userId, parentId };
    const files = await dbClient.db
      .collection('files')
      .aggregate([
        { $match: query },
        { $skip: page * pageSize },
        { $limit: pageSize },
      ])
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const updateResult = await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(id) }, { $set: { isPublic: true } });

    if (!updateResult.matchedCount) return res.status(500).json({ error: 'Failed to publish file' });

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
    return res.status(200).json({
      id: updatedFile._id.toString(),
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId || null,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const updateResult = await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(id) }, { $set: { isPublic: false } });

    if (!updateResult.matchedCount) return res.status(500).json({ error: 'Failed to unpublish file' });

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });
    return res.status(200).json({
      id: updatedFile._id.toString(),
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId || null,
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];

    try {
      // Step 1: Retrieve the user based on the token
      const user = await dbClient.db.collection('users').findOne({ token });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Step 2: Retrieve the file document based on the fileId
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Step 3: Check if the file is public and the user is authorized
      if (!file.isPublic && (!token || file.userId !== user._id.toString())) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Step 4: Check if the file is a folder
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      // Step 5: Check if the file exists locally
      const filePath = `./data/${file.name}`;
      try {
        await fs.access(filePath);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Step 6: Get MIME type
      const mimeType = mime.lookup(file.name);
      if (!mimeType) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Step 7: Return the file content
      const fileContent = await fs.readFile(filePath);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileContent);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(req, res) {
    try {
      const { id } = req.params;
      const token = req.headers['x-token']; // Authentication token from headers
      let userId = null;

      if (token) {
        // Retrieve user ID from Redis using the token
        userId = await redisClient.get(`auth_${token}`);
      }

      // Find the file document in MongoDB by ID
      const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(id) });

      if (!file) {
        // If no file document is found
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is public or the user is the owner
      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // If the file is a folder, return an error
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      // Check if the file exists locally
      const filePath = path.resolve(file.localPath); // Assuming `localPath` stores the file's path

      try {
        await fs.access(filePath); // Check if the file exists locally
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get the MIME type of the file
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      // Set the correct MIME type and send the file content
      res.setHeader('Content-Type', mimeType);
      const fileContent = await fs.readFile(filePath); // Read the file content
      return res.send(fileContent); // Send the file content as the response
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
module.exports = FilesController;
