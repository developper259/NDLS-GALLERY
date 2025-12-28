const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static");
const config = require("../config/config.json");
const crypto = require("crypto");

// Configurer le chemin de FFmpeg et FFprobe
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Cache pour les dimensions de vidéos
const videoDimensionsCache = new Map();

// Générer un nom de fichier unique
generateFileName = (originalName) => {
  const ext = path.extname(originalName);
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
};

generateHash = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

// Vérifier si un fichier est une image
const isImage = (mimetype) => {
  return mimetype.startsWith("image/");
};

// Vérifier si un fichier est une vidéo
const isVideo = (mimetype) => {
  return mimetype.startsWith("video/");
};

// Créer une miniature pour une image
const createImageThumbnail = async (sourcePath, destPath) => {
  try {
    await sharp(sourcePath)
      .resize(300, 300, { fit: "inside" })
      .jpeg({ quality: 80 })
      .toFile(destPath);
    return true;
  } catch (error) {
    console.error("Erreur lors de la création de la miniature d'image:", error);
    return false;
  }
};

// Créer une miniature pour une vidéo
const createVideoThumbnail = (sourcePath, destPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .screenshots({
        timestamps: ["00:00:01.000"],
        filename: path.basename(destPath),
        folder: path.dirname(destPath),
        size: "300x?",
      })
      .on("end", () => resolve(true))
      .on("error", (err) => {
        console.error("Erreur lors de la création de la miniature vidéo:", err);
        resolve(false);
      });
  });
};

// Créer une miniature pour un média
const createThumbnail = async (filePath, mimeType) => {
  try {
    const ext = path.extname(filePath);
    const thumbPath = path.join(
      config.paths.thumbs,
      `${path.basename(filePath, ext)}.jpg`
    );

    // S'assurer que le dossier des miniatures existe
    await fs.ensureDir(config.paths.thumbs);

    if (isImage(mimeType)) {
      await createImageThumbnail(filePath, thumbPath);
    } else if (isVideo(mimeType)) {
      await createVideoThumbnail(filePath, thumbPath);
    }

    return `/thumbs/${path.basename(thumbPath)}`;
  } catch (error) {
    console.error("Erreur dans createThumbnail:", error);
    return null;
  }
};

const getThumb = (media) => {
  const filename = path.basename(media, path.extname(media));
  return `/thumbs/${filename}.jpg`;
};

// Obtenir les dimensions d'une image
const getImageDimensions = async (filePath) => {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des dimensions:", error);
    return { width: null, height: null };
  }
};

// Obtenir les dimensions d'une vidéo
const getVideoDimensions = (filePath) => {
  // Vérifier le cache d'abord
  const cacheKey = filePath;
  if (videoDimensionsCache.has(cacheKey)) {
    return Promise.resolve(videoDimensionsCache.get(cacheKey));
  }

  return new Promise((resolve) => {
    // Options optimisées pour une analyse rapide
    ffmpeg.ffprobe(
      filePath,
      {
        // Limiter l'analyse aux flux vidéo uniquement
        select_streams: "v",
        // Obtenir seulement les métadonnées de base
        show_streams: true,
        show_format: false,
      },
      (err, metadata) => {
        if (err) {
          console.error("Erreur ffprobe:", err);
          const result = { width: null, height: null, duration: null };
          // Mettre en cache même les erreurs pour éviter de réessayer
          videoDimensionsCache.set(cacheKey, result);
          return resolve(result);
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );

        const result = {
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          duration: Math.round(metadata.format?.duration || 0) || null,
        };

        // Mettre en cache le résultat
        videoDimensionsCache.set(cacheKey, result);
        resolve(result);
      }
    );
  });
};

module.exports = {
  generateFileName,
  generateHash,
  isImage,
  isVideo,
  createThumbnail,
  getImageDimensions,
  getVideoDimensions,
  getThumb,
};
