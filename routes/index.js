const express = require('express');
const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController');
const FilesController = require('../controllers/FilesController');

const router = express.Router();

// App routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// User routes
router.post('/users', UsersController.postNew);
router.get('/users/me', UsersController.getMe);

// New routes for authentication and user actions
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);

// File UUpload routes
router.post('/files', FilesController.postUpload);
router.post("/files", FilesController.postUpload);
router.get("/files/:id", FilesController.getShow);
router.get("/files", FilesController.getIndex);

module.exports = router;
