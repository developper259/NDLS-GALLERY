require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs-extra");
const config = require("./config/config.json");
const db = require("./addon/database");

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, "../Client")));

// Servir les médias et miniatures
app.use("/media", express.static(config.paths.media));

app.use("/thumbs", express.static(config.paths.thumbs));

// Routes API
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);


// Routes API
app.use("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error("Erreur non gérée:", err);
  res.status(500).json({
    success: false,
    message: "Une erreur inattendue est survenue",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// Fonction pour démarrer le serveur
const startServer = async () => {
  try {
    // S'assurer que les dossiers nécessaires existent
    await fs.ensureDir(config.paths.media);
    await fs.ensureDir(config.paths.thumbs);
    await fs.ensureDir(config.paths.tmp);

    const album = require("./addon/album");
    await album.createFavoriteAlbum();

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
      console.log(`Environnement: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Erreur lors du démarrage du serveur:", error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre du serveur
const shutdown = async () => {
  console.log("Arrêt du serveur en cours...");
  try {
    await db.close();
    console.log("Base de données déconnectée");
    process.exit(0);
  } catch (error) {
    console.error("Erreur lors de la fermeture de la base de données:", error);
    process.exit(1);
  }
};

// Gestion des signaux d'arrêt
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Démarrer le serveur
startServer();
