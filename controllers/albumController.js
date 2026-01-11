const Album = require("../addon/album");
const config = require('../config/config.json');
const { getThumb } = require("../utils/fileUtils");

// Générer un thumbnail de base pour les albums sans média
const getDefaultThumbnail = () => {
  return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QxZDJkNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIj48L3JlY3Q+PGNpcmNsZSBjeD0iOC41IiBjeT0iOS41IiByPSIxLjUiPjwvY2lyY2xlPjxwb2x5bGluZSBwb2ludHM9IjIxIDE1IDE2IDEwIDUgMjEiPjwvcG9seWxpbmU+PC9zdmc+";
};

// Créer un nouvel album
const createAlbum = async (req, res) => {
  try {
    const { name, description } = req.body;
    const album = await Album.create({ name, description });

    res.status(201).json({
      success: true,
      data: album,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'album:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Récupérer tous les albums
const getAllAlbums = async (req, res) => {
  try {
    const albums = await Album.getAll();

    // Ajouter le thumbnail et le nombre de médias à chaque album
    const albumsWithThumbnails = await Promise.all(
      albums.map(async (album) => {
        // Récupérer le premier média de l'album
        const media = await Album.getMedia(album.id);

        let thumbnail = getDefaultThumbnail();
        let mediaCount = media.length;

        if (mediaCount > 0) {
          // Utiliser le thumbnail du premier média
          thumbnail = getThumb(media[0].file_path);
        }

        return {
          ...album,
          thumbnail,
          mediaCount,
        };
      })
    );

    res.json({
      success: true,
      data: albumsWithThumbnails,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des albums:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des albums",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Récupérer un album par son ID
const getAlbumById = async (req, res) => {
  try {
    const album = await Album.getById(req.params.id);
    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album non trouvé",
      });
    }

    res.json({
      success: true,
      data: album,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'album:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Mettre à jour un album
const updateAlbum = async (req, res) => {
  try {
    const { name, description } = req.body;
    const album = await Album.update(req.params.id, { name, description });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album non trouvé",
      });
    }

    res.json({
      success: true,
      data: album,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'album:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Supprimer un album
const deleteAlbum = async (req, res) => {
  try {
    if (parseInt(req.params.id) === config.album.favoriteIndex) {
      return res.status(400).json({
        success: false,
        message: "Impossible de supprimer l'album favori",
      });
    }

    const result = await Album.delete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Album non trouvé",
      });
    }

    res.json({
      success: true,
      message: "Album supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'album:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Ajouter un média à un album
const addMediaToAlbum = async (req, res) => {
  try {
    const mediaId = req.body.mediaId;
    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: "ID du média requis",
      });
    }
    const result = await Album.addMedia(req.params.albumId, mediaId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout des médias à l'album:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'ajout des médias à l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Supprimer un média d'un album
const removeMediaFromAlbum = async (req, res) => {
  try {
    const mediaId = req.body.mediaId;
    const result = await Album.removeMedia(req.params.albumId, mediaId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la suppression du média de l'album:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du média de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

const getMediaFromAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    const result = await Album.getMedia(albumId);
    
    // Récupérer tous les favoris en une seule requête
    const favoriteIds = await Album.getAllFavoriteIds();
    
    const filteredMedia = result.map((item) => ({
      id: item.id,
      name: item.original_name,
      path: item.file_path,
      thumb: getThumb(item.file_path),
      type: item.file_type.startsWith("video/") ? "video" : "image",
      favorite: favoriteIds.includes(item.id),
      size: item.file_size,
      hash: item.hash,
      dimension: item.dimension ? {
        width: parseInt(item.dimension.split('x')[0]),
        height: parseInt(item.dimension.split('x')[1])
      } : null,
      duration: item.duration,
      creation_date: item.creation_date,
      upload_date: item.upload_date,
      trashed_at: item.trashed_at,
      createdAt: item.created_at,
    }));

    res.json({
      success: true,
      data: filteredMedia,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des médias de l'album:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des médias de l'album",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};
module.exports = {
  createAlbum,
  getAllAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  addMediaToAlbum,
  removeMediaFromAlbum,
  getMediaFromAlbum,
};
