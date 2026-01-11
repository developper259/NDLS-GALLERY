const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs-extra");
const config = require("../config/config.json");

class Database {
  constructor() {
    // Initialiser la configuration
    this.config = config;

    // Créer les dossiers nécessaires de manière synchrone
    this.ensureDirectories();

    // Initialiser la base de données
    this.initializeDatabaseConnection();
  }

  ensureDirectories() {
    const directories = [this.config.paths.thumbs, this.config.database.path];

    directories.forEach((dir) => {
      try {
        fs.ensureDirSync(dir);
      } catch (error) {
        console.error(`Erreur lors de la création du dossier ${dir}:`, error);
        if (dir === this.config.database.path) {
          throw error; // On arrête si on ne peut pas créer le dossier de la base de données
        }
      }
    });
  }

  initializeDatabaseConnection() {
    const dbPath = path.join(
      this.config.database.path,
      this.config.database.filename
    );

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Erreur de connexion à la base de données:", err);
        throw err;
      }

      console.log("Connecté à la base de données SQLite");
      this.configureDatabase();
    });
  }

  configureDatabase() {
    this.db.serialize(() => {
      // Activer les fonctionnalités avancées de SQLite
      this.db.run("PRAGMA foreign_keys = ON;");
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA busy_timeout = 30000;");

      // Créer les tables si elles n'existent pas
      this.createTables().catch((err) => {
        console.error("Erreur lors de la création des tables:", err);
      });
    });
  }

  async createTables() {
    try {
      // Création de la table albums
      await this.run(`
                CREATE TABLE IF NOT EXISTS albums (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    cover_image TEXT,
                    is_favorite BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

      // Création de la table media
      await this.run(`
                CREATE TABLE IF NOT EXISTS media (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    hash TEXT NOT NULL,
                    dimension TEXT,
                    album_id INTEGER,
                    is_trashed BOOLEAN DEFAULT 0,
                    trashed_at DATETIME,
                    creation_date DATETIME,
                    upload_date DATETIME,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
                )
            `);

      // Création de la table de liaison album_media
      await this.run(`
                CREATE TABLE IF NOT EXISTS album_media (
                    album_id INTEGER,
                    media_id INTEGER,
                    position INTEGER,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (album_id, media_id),
                    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
                    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
                )
            `);

      console.log("Base de données initialisée avec succès");
      return Promise.resolve();
    } catch (error) {
      console.error("Erreur lors de la création des tables:", error);
      return Promise.reject(error);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          console.error("Erreur SQL (run):", err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error("Erreur SQL (get):", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error("Erreur SQL (all):", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          console.error(
            "Erreur lors de la fermeture de la base de données:",
            err
          );
          reject(err);
        } else {
          console.log("Connexion à la base de données fermée");
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
