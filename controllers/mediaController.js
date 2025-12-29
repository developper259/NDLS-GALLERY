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

// Fonction pour obtenir les dimensions depuis le fichier
const getDimension = async (filePath, fileType) => {
  try {
    const fullPath = path.join(dataPath, filePath);

    if (fileType.startsWith("video/")) {
      const dimensions = await getVideoDimensions(fullPath);
      return { width: dimensions.width, height: dimensions.height };
    } else {
      const dimensions = await getImageDimensions(fullPath);
      return { width: dimensions.width, height: dimensions.height };
    }
  } catch (error) {
    console.error("Erreur lors de la lecture des dimensions:", error);
    return { width: null, height: null };
  }
};

// Récupérer tous les médias
const getAllMedia = async (req, res) => {
  try {
    const includeTrashed = req.query.includeTrashed === "true";
    const media = await Media.getAll(includeTrashed);

    // 1. On crée un tableau de promesses (remarquez le async devant l'item)
    const promises = media.map(async (item) => ({
      id: item.id,
      name: item.original_name,
      path: item.file_path,
      thumb: getThumb(item.file_path),
      type: item.file_type.startsWith("video/") ? "video" : "image",
      favorite: await Album.isFavorite(item.id), // L'await fonctionne ici
      size: item.file_size,
      hash: item.hash,
      width: item.width,
      height: item.height,
      dimension: await getDimension(item.file_path, item.file_type),
      duration: item.duration,
      creation_date: item.creation_date,
      upload_date: item.upload_date,
    }));

    // 2. On attend que toutes les promesses du tableau soient terminées
    const filteredMedia = await Promise.all(promises);

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

    const results = [];
    // Créer les dossiers s'ils n'existent pas
    await fs.ensureDir(mediaPath);
    await fs.ensureDir(thumbsPath);

    // Traiter chaque fichier téléchargé
    for (const file of req.files) {
      try {
        if (!isImage(file.mimetype) && !isVideo(file.mimetype)) {
          throw new Error("Type de fichier non supporté");
        }

        // Générer un nom de fichier unique pour le dossier media
        const filename = generateFileName(file.originalname);
        const fileHash = await generateHash(file.path);
        const destPath = path.join(mediaPath, filename);
        const existingMedia = await Media.getByHash(fileHash);
        if (existingMedia) {
          res.status(207).json({
            success: false,
            message: "Le fichier existe déjà",
            results,
          });
          return;
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

        // Créer la miniature
        if (!creation_date) {
          creation_date = new Date();
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
          hash: fileHash,
          width: width,
          height: height,
          duration: duration,
          creation_date: creation_date,
        };

        // Ici, vous pouvez ajouter la logique pour générer une miniature
        // et mettre à jour mediaData.thumb_path
        const media = await Media.create(mediaData);

        results.push({
          success: true,
          id: media.id,
          name: media.originalName,
          path: media.path,
          thumb: media.thumb,
          type: media.type.startsWith("video/") ? "video" : "image",
          size: media.size,
          hash: media.hash,
          width: media.width,
          height: media.height,
          duration: media.duration || 0,
          creation_date: media.creation_date,
        });
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

        results.push({
          success: false,
          name: file.originalname,
          error: error.message,
        });
      }
    }

    // Vérifier si des erreurs se sont produites
    const hasErrors = results.some((result) => !result.success);

    res.status(hasErrors ? 207 : 201).json({
      success: !hasErrors,
      message: hasErrors
        ? "Certains fichiers n'ont pas pu être téléchargés"
        : "Tous les fichiers ont été téléchargés avec succès",
      results,
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
      width: item.width,
      height: item.height,
      duration: item.duration,
      createdAt: item.created_at,
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
  downloadMedia,
  uploadMedia,
  moveToTrash,
  getTrashedMedia,
  restoreFromTrash,
  deletePermanently,
  emptyTrash,
};
