const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db'); // Assume MongoDB utils file
const userAuth = require('../utils/auth'); // Token-based user authentication
const mime = require('mime-types');
const fileQueue = require('../worker');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    // Valid token
    const user = await userAuth.getUserFromToken(token);
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    // Valid required fields
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) return res.status(400).send({ error: 'Missing name' });
    if (!['folder', 'file', 'image'].includes(type)) return res.status(400).send({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).send({ error: 'Missing data' });

    let parentFolder;
    if (parentId !== 0) {
      parentFolder = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!parentFolder) return res.status(400).json({ error: 'Parent not found' });
      if (parentFolder.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileData = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'file' || type === 'image') {
      const localPath = path.join(FOLDER_PATH, uuidv4());
      fs.mkdirSync(FOLDER_PATH, { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
      fileData.localPath = localPath;
    }

    const result = await dbClient.files.insertOne(fileData);
    return res.status(201).json({
      id: result.insertedId,
      ...fileData,
    });
  }

  // Additional methods will be implemented here
  static async getShow(req, res) {
    const token = req.headers['x-token'];

    // Valid token
    const user = await userAuth.getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({
      _id: ObjectId(fileId),
      userId: user._id,
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const user = await userAuth.getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { parentId = 0, page = 0 } = req.query;
    const files = await dbClient.files
      .find({ userId: user._id, parentId })
      .skip(page * 20)
      .limit(20)
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const user = await userAuth.getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({
      _id: ObjectId(fileId),
      userId: user._id,
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.files.updateOne(
      { _id: ObjectId(fileId) },
      { $set: { isPublic: true } },
    );
    return res.status(200).json({ ...file, isPublic: true });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const user = await userAuth.getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.files.findOne({
      _id: ObjectId(fileId),
      userId: user._id,
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.files.updateOne(
      { _id: ObjectId(fileId) },
      { $set: { isPublic: false } },
    );
    return res.status(200).json({ ...file, isPublic: false });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const { user } = req;
    const { size } = req.query;

    try {
      const fileDocument = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(fileId) });

      if (!fileDocument) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (fileDocument.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      if (
        !fileDocument.isPublic
        && (!user || fileDocument.userId.toString() !== user._id.toString())
      ) {
        return res.status(404).json({ error: 'Not found' });
      }

      let filePath = fileDocument.localPath;
      if (size) {
        filePath = `${filePath}_${size}`;
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.lookup(fileDocument.name) || 'application/octet-stream';
      res.set('Content-Type', mimeType);
      return res.sendFile(filePath);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
