const db = require("./database");
const fs = require("fs-extra");
const path = require("path");
const config = require("../config/config.json");
const { getThumb } = require("../utils/fileUtils");

class Media {
  // Ajouter un nouveau média
  static async create(file, albumId = null) {
    try {
      // Insérer les informations dans la base de données
      const result = await db.run(
        `INSERT INTO media 
                (original_name, file_name, file_path, file_type, file_size, hash, album_id, creation_date, upload_date, dimension)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.originalName,
          file.fileName,
          file.path,
          file.type,
          file.size,
          file.hash,
          albumId,
          file.creation_date,
          file.upload_date,
          file.dimension,
        ]
      );

      // Si un album est spécifié, lier le média à l'album
      if (albumId) {
        await Album.addMedia(albumId, result.id);
      }

      return { id: result.id, ...file };
    } catch (error) {
      console.error("Erreur lors de l'ajout du média:", error);
      // Supprimer le fichier en cas d'erreur
      if (file && file.path) {
        await fs.remove(file.path).catch(console.error);
      }
      throw error;
    }
  }

  // Vérifier rapidement si un média existe déjà (nom original + taille)
  static async getByOriginalNameAndSize(originalName, fileSize) {
    try {
      return await db.get(
        "SELECT id FROM media WHERE original_name = ? AND file_size = ?",
        [originalName, fileSize]
      );
    } catch (error) {
      console.error("Erreur lors de la vérification du média:", error);
      throw error;
    }
  }

  // Déplacer un média vers la corbeille
  static async moveToTrash(mediaId) {
    try {
      // Marquer le média comme supprimé
      await db.run(
        "UPDATE media SET is_trashed = 1, trashed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [mediaId]
      );

      // Récupérer les informations du média mis à jour
      return await db.get("SELECT id, original_name FROM media WHERE id = ?", [
        mediaId,
      ]);
    } catch (error) {
      throw error;
    }
  }

  // Restaurer un média depuis la corbeille
  static async restoreFromTrash(mediaId) {
    try {
      await db.run(
        "UPDATE media SET is_trashed = 0, trashed_at = NULL WHERE id = ?",
        [mediaId]
      );
      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la restauration depuis la corbeille:",
        error
      );
      throw error;
    }
  }

  // Supprimer définitivement un média
  static async deletePermanently(mediaId) {
    try {
      // Récupérer les informations du fichier
      const media = await db.get("SELECT * FROM media WHERE id = ?", [mediaId]);
      if (!media) return false;

      const filename = path.basename(
        media.file_name,
        path.extname(media.file_name)
      );
      // Supprimer le fichier physique
      if (media.file_path) {
        await fs
          .remove(path.join(config.paths.media, media.file_name))
          .catch(console.error);
        await fs
          .remove(path.join(config.paths.thumbs, filename + ".jpg"))
          .catch(console.error);
      }

      // Supprimer les entrées dans album_media
      await db.run("DELETE FROM album_media WHERE media_id = ?", [mediaId]);

      // Supprimer l'entrée dans la table media
      await db.run("DELETE FROM media WHERE id = ?", [mediaId]);

      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la suppression définitive du média:",
        error
      );
      throw error;
    }
  }

  // Vider la corbeille
  static async emptyTrash() {
    try {
      // Récupérer tous les médias dans la corbeille
      const trashedMedia = await db.all(
        "SELECT * FROM media WHERE is_trashed = 1"
      );

      const filename = path.basename(
        media.file_name,
        path.extname(media.file_name)
      );

      // Supprimer les fichiers physiques
      for (const media of trashedMedia) {
        if (media.file_path) {
          await fs
            .remove(path.join(config.paths.media, media.file_name))
            .catch(console.error);
          await fs
            .remove(path.join(config.paths.thumbs, filename + ".jpg"))
            .catch(console.error);
        }
      }

      // Supprimer les entrées dans album_media
      await db.run(
        "DELETE FROM album_media WHERE media_id IN (SELECT id FROM media WHERE is_trashed = 1)"
      );

      // Supprimer les entrées dans la table media
      await db.run("DELETE FROM media WHERE is_trashed = 1");

      return { deletedCount: trashedMedia.length };
    } catch (error) {
      console.error("Erreur lors de la vidage de la corbeille:", error);
      throw error;
    }
  }

  // Récupérer tous les médias dans la corbeille
  static async getTrashed() {
    try {
      return await db.all(
        "SELECT id, original_name, file_name, file_path, file_type, file_size, hash, dimension, album_id, is_trashed, trashed_at, creation_date, upload_date, updated_at FROM media WHERE is_trashed = 1 ORDER BY trashed_at DESC"
      );
    } catch (error) {
      console.error("Erreur lors de la récupération de la corbeille:", error);
      throw error;
    }
  }

  // Récupérer un média par son ID
  static async getById(id) {
    try {
      return await db.get("SELECT id, original_name, file_name, file_path, file_type, file_size, hash, dimension, album_id, is_trashed, trashed_at, creation_date, upload_date, updated_at FROM media WHERE id = ?", [id]);
    } catch (error) {
      console.error("Erreur lors de la récupération du média:", error);
      throw error;
    }
  }

  static async getByHash(hash) {
    try {
      return await db.get("SELECT id, original_name, file_name, file_path, file_type, file_size, hash, dimension, album_id, is_trashed, trashed_at, creation_date, upload_date, updated_at FROM media WHERE hash = ?", [hash]);
    } catch (error) {
      console.error("Erreur lors de la récupération du média:", error);
      throw error;
    }
  }

  // Récupérer tous les médias (hors corbeille par défaut)
  static async getAll(includeTrashed = false) {
    try {
      const query = includeTrashed
        ? "SELECT id, original_name, file_name, file_path, file_type, file_size, hash, dimension, album_id, is_trashed, trashed_at, creation_date, upload_date, updated_at FROM media ORDER BY creation_date DESC"
        : "SELECT id, original_name, file_name, file_path, file_type, file_size, hash, dimension, album_id, is_trashed, trashed_at, creation_date, upload_date, updated_at FROM media WHERE is_trashed = 0 ORDER BY creation_date DESC";

      return await db.all(query);
    } catch (error) {
      console.error("Erreur lors de la récupération des médias:", error);
      throw error;
    }
  }

  // Mettre à jour les métadonnées d'un média
  static async update(id, data) {
    try {
      const fields = [];
      const params = [];

      // Construire dynamiquement la requête en fonction des champs fournis
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      });

      if (fields.length === 0) {
        return false; // Aucun champ à mettre à jour
      }

      params.push(id);

      const query = `UPDATE media SET ${fields.join(", ")} WHERE id = ?`;
      const result = await db.run(query, params);

      return result.changes > 0;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du média:", error);
      throw error;
    }
  }
}

module.exports = Media;
