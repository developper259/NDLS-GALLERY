const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const config = require("../config/config.json");

// Construire les chemins complets
const dataPath = path.join(process.cwd(), "data");

// Configuration de multer pour le stockage temporaire des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer le dossier tmp s'il n'existe pas
    const tmpPath = path.join(dataPath, "tmp");
    fs.ensureDirSync(tmpPath);
    cb(null, tmpPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Créer une expression régulière pour les types de fichiers autorisés
const allowedFileTypes = new RegExp(
  `^(${config.limits.allowedFileTypes
    .map((ext) => `\\.${ext.replace(/\./g, "\\.")}`)
    .join("|")})$`,
  "i"
);

// Configuration de base de multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.limits.fileSize, // 50MB par défaut
    files: config.limits.maxFiles,
  },
  fileFilter: (req, file, cb) => {
    const extname = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    const expectedMime = config.mimeTypes[ext];
    const mimetype = expectedMime && expectedMime === file.mimetype;

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      const allowedExtensions = config.limits.allowedFileTypes.join(", ");
      cb(
        new Error(
          `Type de fichier non supporté. Extensions autorisées : ${allowedExtensions}`
        )
      );
    }
  },
});

// Middleware pour gérer l'upload
const handleUpload = (req, res, next) => {
  const uploadMiddleware = upload.array("files", 10);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.message || "Erreur lors du téléchargement du fichier",
          code: err.code,
        });
      } else {
        console.error("Erreur lors de l'upload:", err);
        return res.status(500).json({
          success: false,
          message: "Une erreur est survenue lors du téléchargement du fichier",
          error:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
    }

    if (typeof next === "function") {
      return next();
    }

    return res.status(200).json({
      success: true,
      message: "Fichier(s) téléchargé(s) avec succès",
    });
  });
};

module.exports = {
  upload,
  handleUpload,
};
