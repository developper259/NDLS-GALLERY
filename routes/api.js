const express = require("express");
const router = express.Router();
const { handleUpload } = require("../middlewares/upload");
const mediaController = require("../controllers/mediaController");
const albumController = require("../controllers/albumController");
const storageController = require("../controllers/storageController");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const authenticateToken = require("../middleware/auth");

// ====================
// Routes pour les médias
// ====================

/**
 * @route   GET /api/media
 * @desc    Récupérer tous les médias de l'utilisateur connecté
 * @access  Private
 */
router.get("/media", authenticateToken, mediaController.getAllMedia);

/**
 * @route   GET /api/media/:id
 * @desc    Récupérer un média par son ID (vérification d'appartenance)
 * @access  Private
 */
router.get("/media/:id", authenticateToken, mediaController.getMediaById);

/**
 * @route   GET /api/media/download/:id
 * @desc    Télécharger un média (vérification d'appartenance)
 * @access  Private
 */
router.get("/media/download/:id", authenticateToken, mediaController.downloadMedia);

/**
 * @route   POST /api/media/upload
 * @desc    Téléverser un ou plusieurs fichiers
 * @access  Private
 */
router.post("/media/upload", authenticateToken, handleUpload, mediaController.uploadMedia);

/**
 * @route   DELETE /api/media/:id
 * @desc    Déplacer un média vers la corbeille
 * @access  Private
 * @param   {string} id - L'ID du média à déplacer vers la corbeille
 */
router.delete("/media/:id", authenticateToken, mediaController.moveToTrash);

// ====================
// Routes pour la corbeille
// ====================

/**
 * @route   GET /api/trash
 * @desc    Récupérer les éléments de la corbeille de l'utilisateur
 * @access  Private
 */
router.get("/trash", authenticateToken, mediaController.getTrashedMedia);

/**
 * @route   POST /api/trash/restore/:id
 * @desc    Restaurer un média depuis la corbeille
 * @access  Private
 */
router.post("/trash/restore/:id", authenticateToken, mediaController.restoreFromTrash);

/**
 * @route   DELETE /api/trash/:id
 * @desc    Supprimer définitivement un média
 * @access  Private
 */
router.delete("/trash/:id", authenticateToken, mediaController.deletePermanently);

/**
 * @route   DELETE /api/trash
 * @desc    Vider la corbeille
 * @access  Private
 */
router.delete("/trash", authenticateToken, mediaController.emptyTrash);

// ====================
// Routes pour le stockage
// ====================

/**
 * @route   GET /api/storage
 * @desc    Récupérer les statistiques de stockage de l'utilisateur
 * @access  Private
 */
router.get("/storage", authenticateToken, storageController.getStorageStats);

// ====================
// Routes pour les albums
// ====================

/**
 * @route   GET /api/albums
 * @desc    Récupérer tous les albums de l'utilisateur
 * @access  Private
 */
router.get("/albums", authenticateToken, albumController.getAllAlbums);

/**
 * @route   GET /api/albums/:id
 * @desc    Récupérer un album par son ID (vérification d'appartenance)
 * @access  Private
 */
router.get("/albums/:id", authenticateToken, albumController.getAlbumById);

/**
 * @route   POST /api/albums
 * @desc    Créer un nouvel album
 * @access  Private
 */
router.post("/albums", authenticateToken, albumController.createAlbum);

/**
 * @route   PUT /api/albums/:id
 * @desc    Mettre à jour un album (vérification d'appartenance)
 * @access  Private
 */
router.put("/albums/:id", authenticateToken, albumController.updateAlbum);

/**
 * @route   DELETE /api/albums/:id
 * @desc    Supprimer un album (vérification d'appartenance)
 * @access  Private
 */
router.delete("/albums/:id", authenticateToken, albumController.deleteAlbum);

/**
 * @route   GET /api/albums/:albumId/media
 * @desc    Récupérer les médias d'un album (vérification d'appartenance)
 * @access  Private
 */
router.get("/albums/:albumId/media", authenticateToken, albumController.getMediaFromAlbum);

/**
 * @route   POST /api/albums/:albumId/media
 * @desc    Ajouter des médias à un album (vérification d'appartenance)
 * @access  Private
 */
router.post("/albums/:albumId/media", authenticateToken, albumController.addMediaToAlbum);

/**
 * @route   DELETE /api/albums/:albumId/media
 * @desc    Supprimer des médias d'un album (vérification d'appartenance)
 * @access  Private
 */
router.delete("/albums/:albumId/media", authenticateToken, albumController.removeMediaFromAlbum);

// ====================
// Routes pour l'authentification OAuth2
// ====================

/**
 * @route   POST /api/auth/create-user
 * @desc    Créer un utilisateur et sauvegarder les tokens localement
 * @access  Private
 */
router.post("/auth/create-user", authenticateToken, authController.createUserAndTokens);

/**
 * @route   GET /api/auth/login
 * @desc    Initier la connexion OAuth2
 * @access  Public
 */
router.get("/auth/login", authController.initiateLogin);

/**
 * @route   POST /api/auth/callback
 * @desc    Callback OAuth2 - Échanger le code contre des tokens
 * @access  Public
 */
router.post("/auth/callback", authController.handleCallback);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchir le token d'accès
 * @access  Public
 */
router.post("/auth/refresh", authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion
 * @access  Public
 */
router.post("/auth/logout", authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Récupérer l'utilisateur connecté
 * @access  Private
 */
router.get("/auth/me", authController.getMe);

// ====================
// Routes pour les utilisateurs
// ====================

/**
 * @route   GET /api/users/storage-stats
 * @desc    Récupérer les statistiques de stockage de l'utilisateur
 * @access  Private
 */
router.get("/users/storage-stats", authenticateToken, userController.getStorageStats);

/**
 * @route   PUT /api/users/storage-limit
 * @desc    Mettre à jour la limite de stockage de l'utilisateur
 * @access  Private
 */
router.put("/users/storage-limit", authenticateToken, userController.updateStorageLimit);

// Exporter le routeur
module.exports = router;
