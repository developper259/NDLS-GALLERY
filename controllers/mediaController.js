const exifParser = require("exif-parser");
const Media = require("../addon/media");
const Album = require("../addon/album");
const fs = require("fs-extra");
const path = require("path");
const {
  generateFileName,
  generateHash,
  isImage,
  isVideo,
  createThumbnail,
  getImageDimensions,
  getVideoDimensions,
  getThumb,
} = require("../utils/fileUtils");
const config = require("../config/config.json");

// Construire les chemins complets
const dataPath = path.join(process.cwd(), "data");
const mediaPath = path.join(dataPath, "media");
const thumbsPath = path.join(dataPath, "thumbs");

// Récupérer tous les médias
const getAllMedia = async (req, res) => {
  try {
    const includeTrashed = req.query.includeTrashed === "true";
    const media = await Media.getAll(includeTrashed);

    // Récupérer tous les favoris en une seule requête
    const favoriteIds = await Album.getAllFavoriteIds();

    // Transformer les médias sans opérations coûteuses
    const filteredMedia = media.map((item) => ({
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
    }));

    res.json({ success: true, data: filteredMedia });
  } catch (error) {
    console.error("Erreur lors de la récupération des médias:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des médias",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Télécharger un média
const downloadMedia = async (req, res) => {
  try {
    const media = await Media.getById(req.params.id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Média non trouvé",
      });
    }

    res.download(media.file_path, media.original_name);
  } catch (error) {
    console.error("Erreur lors du téléchargement du média:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du téléchargement du média",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Récupérer un média par son ID
const getMediaById = async (req, res) => {
  try {
    const media = await Media.getById(req.params.id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Média non trouvé",
      });
    }

    // Récupérer les favoris en une seule requête
    const favoriteIds = await Album.getAllFavoriteIds();

    const mediaData = {
      id: media.id,
      name: media.original_name,
      path: media.file_path,
      thumb: getThumb(media.file_path),
      type: media.file_type.startsWith("video/") ? "video" : "image",
      favorite: favoriteIds.includes(media.id),
      size: media.file_size,
      hash: media.hash,
      dimension: media.dimension ? {
        width: parseInt(media.dimension.split('x')[0]),
        height: parseInt(media.dimension.split('x')[1])
      } : null,
      duration: media.duration,
      creation_date: media.creation_date,
      upload_date: media.upload_date,
      trashed_at: media.trashed_at,
    };

    res.json({ success: true, data: mediaData });
  } catch (error) {
    console.error("Erreur lors de la récupération du média:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du média",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Supprimer un média (déplacer vers la corbeille)
const moveToTrash = async (req, res) => {
  try {
    const result = await Media.moveToTrash(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Média non trouvé ou déjà supprimé",
      });
    }

    // Supprimer le média de tous les albums, y compris les favoris
    try {
      await Album.removeMediaFromAllAlbums(result.id);
    } catch (albumError) {
      // On continue quand même car le média est déjà marqué comme supprimé
    }

    res.json({
      success: true,
      id: result.id,
      name: result.original_name,
      message: "Média déplacé vers la corbeille",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du média:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du média",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Restaurer un média depuis la corbeille
const restoreFromTrash = async (req, res) => {
  try {
    const media = await Media.restoreFromTrash(req.params.id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Média non trouvé ou déjà restauré",
      });
    }

    res.json({
      success: true,
      id: media.id,
      name: media.original_name,
      message: "Média restauré",
    });
  } catch (error) {
    console.error("Erreur lors de la restauration du média:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la restauration du média",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Supprimer définitivement un média
const deletePermanently = async (req, res) => {
  try {
    const result = await Media.deletePermanently(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Média non trouvé",
      });
    }

    res.json({
      success: true,
      message: "Média supprimé définitivement",
      id: req.params.id,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression définitive du média:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression définitive du média",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Vider la corbeille
const emptyTrash = async (req, res) => {
  try {
    const result = await Media.emptyTrash();
    res.json({
      success: true,
      message: "Corbeille vidée avec succès",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error("Erreur lors de la vidage de la corbeille:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression des éléments",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Gérer le téléchargement de fichiers
const uploadMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier téléchargé",
      });
    }

    // Créer les dossiers s'ils n'existent pas
    await fs.ensureDir(mediaPath);
    await fs.ensureDir(thumbsPath);

    // Traiter chaque fichier téléchargé en parallèle
    const uploadPromises = req.files.map(async (file) => {
      try {
        if (!isImage(file.mimetype) && !isVideo(file.mimetype)) {
          throw new Error("Type de fichier non supporté");
        }

        // Générer un nom de fichier unique pour le dossier media
        const filename = generateFileName(file.originalname);
        const destPath = path.join(mediaPath, filename);
        
        // Vérifier les doublons avec une méthode rapide (nom original + taille)
        const existingMedia = await Media.getByOriginalNameAndSize(file.originalname, file.size);
        if (existingMedia) {
          return {
            success: false,
            name: file.originalname,
            error: "Le fichier existe déjà",
          };
        }

        // Déplacer le fichier du dossier tmp vers le dossier media
        await fs.move(file.path, destPath);

        // Obtenir les dimensions et la durée
        let width = 0,
          height = 0,
          duration = 0,
          creation_date = null;

        if (isImage(file.mimetype)) {
          const dimensions = await getImageDimensions(destPath);
          width = dimensions.width;
          height = dimensions.height;

          try {
            const buffer = await fs.readFile(destPath);
            const parser = exifParser.create(buffer);
            const result = parser.parse();
            if (result.tags.CreateDate) {
              creation_date = new Date(result.tags.CreateDate * 1000);
            } else if (result.tags.DateTimeOriginal) {
              creation_date = new Date(result.tags.DateTimeOriginal * 1000);
            }
          } catch (exifError) {
            console.error("Could not parse EXIF data:", exifError);
          }
        } else if (isVideo(file.mimetype)) {
          const videoInfo = await getVideoDimensions(destPath);
          width = videoInfo.width;
          height = videoInfo.height;
          duration = videoInfo.duration || 0;
        }

        if (!creation_date) {
          // Utiliser la date de modification du fichier comme fallback
          const stats = await fs.stat(destPath);
          creation_date = stats.mtime;
        }

        const thumbPath = await createThumbnail(destPath, file.mimetype);

        // Créer une entrée média dans la base de données
        const mediaData = {
          originalName: file.originalname,
          fileName: filename,
          path: `/media/${filename}`,
          thumb: thumbPath,
          type: file.mimetype,
          size: file.size,
          hash: `${file.originalname}_${file.size}`, // Utiliser nom+taille comme identifiant unique
          dimension: `${width}x${height}`,
          duration: duration,
          creation_date: creation_date,
          upload_date: new Date(),
        };

        const media = await Media.create(mediaData);

        return {
          success: true,
          id: media.id,
          name: media.originalName,
          path: media.path,
          thumb: media.thumb,
          type: media.type.startsWith("video/") ? "video" : "image",
          size: media.size,
          hash: media.hash,
          dimension: media.dimension ? {
            width: parseInt(media.dimension.split('x')[0]),
            height: parseInt(media.dimension.split('x')[1])
          } : null,
          duration: media.duration || 0,
          creation_date: media.creation_date,
          upload_date: media.upload_date,
          trashed_at: media.trashed_at,
        };
      } catch (error) {
        console.error("Erreur lors du traitement du fichier:", error);

        // Supprimer le fichier en cas d'erreur
        if (file.path && (await fs.pathExists(file.path))) {
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error(
              "Erreur lors de la suppression du fichier temporaire:",
              unlinkError
            );
          }
        }

        return {
          success: false,
          name: file.originalname,
          error: error.message,
        };
      }
    });

    // Attendre que tous les uploads soient terminés
    const uploadResults = await Promise.all(uploadPromises);

    // Vérifier s'il y a des doublons
    const hasDuplicates = uploadResults.some(result => !result.success && result.error === "Le fichier existe déjà");
    
    if (hasDuplicates) {
      res.status(207).json({
        success: false,
        message: "Certains fichiers existent déjà",
        results: uploadResults,
      });
      return;
    }

    res.json({
      success: true,
      message: `${uploadResults.filter(r => r.success).length} fichier(s) téléchargé(s) avec succès`,
      results: uploadResults,
    });
  } catch (error) {
    console.error("Erreur lors du traitement des fichiers:", error);

    // Nettoyer les fichiers téléchargés en cas d'erreur
    if (req.files && req.files.length > 0) {
      await Promise.all(
        req.files.map((file) =>
          file.path
            ? fs.unlink(file.path).catch(console.error)
            : Promise.resolve()
        )
      );
    }

    res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors du traitement des fichiers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer les médias de la corbeille
const getTrashedMedia = async (req, res) => {
  try {
    const trashedMedia = await Media.getTrashed();
    const filteredMedia = trashedMedia.map((item) => ({
      id: item.id,
      name: item.original_name,
      path: item.file_path,
      thumb: getThumb(item.file_path),
      type: item.file_type.startsWith("video/") ? "video" : "image",
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
    }));

    res.json({ success: true, data: filteredMedia });
  } catch (error) {
    console.error("Erreur lors de la récupération de la corbeille:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la corbeille",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

module.exports = {
  getAllMedia,
  getMediaById,
  downloadMedia,
  uploadMedia,
  moveToTrash,
  getTrashedMedia,
  restoreFromTrash,
  deletePermanently,
  emptyTrash,
};
