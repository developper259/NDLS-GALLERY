const express = require("express");
const router = express.Router();
const { handleUpload } = require("../middlewares/upload");
const mediaController = require("../controllers/mediaController");
const albumController = require("../controllers/albumController");
const storageController = require("../controllers/storageController");

// ====================
// Routes pour les médias
// ====================

/**
 * @route   GET /api/media
 * @desc    Récupérer tous les médias
 * @access  Public
 */
router.get("/media", mediaController.getAllMedia);

/**
 * @route   GET /api/media/download/:id
 * @desc    Télécharger un média
 * @access  Public
 */
router.get("/media/download/:id", mediaController.downloadMedia);

/**
 * @route   POST /api/media/upload
 * @desc    Téléverser un ou plusieurs fichiers
 * @access  Private
 */
router.post("/media/upload", handleUpload, mediaController.uploadMedia);

/**
 * @route   DELETE /api/media/:id
 * @desc    Déplacer un média vers la corbeille
 * @access  Private
 * @param   {string} id - L'ID du média à déplacer vers la corbeille
 */
router.delete("/media/:id", mediaController.moveToTrash);

// ====================
// Routes pour la corbeille
// ====================

/**
 * @route   GET /api/trash
 * @desc    Récupérer les éléments de la corbeille
 * @access  Private
 */
router.get("/trash", mediaController.getTrashedMedia);

/**
 * @route   POST /api/trash/restore/:id
 * @desc    Restaurer un média depuis la corbeille
 * @access  Private
 */
router.post("/trash/restore/:id", mediaController.restoreFromTrash);

/**
 * @route   DELETE /api/trash/:id
 * @desc    Supprimer définitivement un média
 * @access  Private
 */
router.delete("/trash/:id", mediaController.deletePermanently);

/**
 * @route   DELETE /api/trash
 * @desc    Vider la corbeille
 * @access  Private
 */
router.delete("/trash", mediaController.emptyTrash);

// ====================
// Routes pour le stockage
// ====================

/**
 * @route   GET /api/storage
 * @desc    Récupérer les statistiques de stockage
 * @access  Private
 */
router.get("/storage", storageController.getStorageStats);

// ====================
// Routes pour les albums
// ====================

/**
 * @route   GET /api/albums
 * @desc    Récupérer tous les albums
 * @access  Public
 */
router.get("/albums", albumController.getAllAlbums);

/**
 * @route   GET /api/albums/:id
 * @desc    Récupérer un album par son ID
 * @access  Public
 */
router.get("/albums/:id", albumController.getAlbumById);

/**
 * @route   POST /api/albums
 * @desc    Créer un nouvel album
 * @access  Private
 */
router.post("/albums", albumController.createAlbum);

/**
 * @route   PUT /api/albums/:id
 * @desc    Mettre à jour un album
 * @access  Private
 */
router.put("/albums/:id", albumController.updateAlbum);

/**
 * @route   DELETE /api/albums/:id
 * @desc    Supprimer un album
 * @access  Private
 */
router.delete("/albums/:id", albumController.deleteAlbum);

/**
 * @route   POST /api/albums/:albumId/media
 * @desc    Ajouter des médias à un album
 * @access  Private
 */
router.get("/albums/:albumId/media", albumController.getMediaFromAlbum);

/**
 * @route   POST /api/albums/:albumId/media
 * @desc    Ajouter des médias à un album
 * @access  Private
 */
router.post("/albums/:albumId/media", albumController.addMediaToAlbum);

/**
 * @route   DELETE /api/albums/:albumId/media
 * @desc    Supprimer des médias d'un album
 * @access  Private
 */
router.delete("/albums/:albumId/media", albumController.removeMediaFromAlbum);

// Healthcheck
router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Exporter le routeur
module.exports = router;
