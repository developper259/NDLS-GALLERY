const db = require("./database");
const fs = require("fs-extra");
const path = require("path");
const config = require("../config/config.json");

class Album {
  static favoriteAlbumId = config.album.favoriteIndex || 1;

  // Vérifier l'espace de stockage disponible pour un utilisateur
  static async checkStorageSpace(userId, requiredSpace) {
    try {
      const user = await db.get(
        'SELECT storage_limit FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      const currentUsage = await db.get(
        'SELECT COALESCE(SUM(file_size), 0) as total_size FROM media WHERE user_id = ? AND is_trashed = 0',
        [userId]
      );

      return (currentUsage.total_size + requiredSpace) <= user.storage_limit;
    } catch (error) {
      console.error("Erreur lors de la vérification de l'espace de stockage:", error);
      throw error;
    }
  }

  // Créer un nouvel album
  static async create({ name, description = "", isFavorite = false, id = null, userId }) {
    try {
      const result = await db.run(
        "INSERT INTO albums (id, user_id, name, description, is_favorite) VALUES (?, ?, ?, ?, ?)",
        [id ? id : null, userId, name, description, isFavorite ? 1 : 0]
      );
      return { id: result.id, name, description, isFavorite };
    } catch (error) {
      console.error("Erreur lors de la création de l'album:", error);
      throw error;
    }
  }

  // Récupérer tous les albums d'un utilisateur
  static async getAllByUser(userId) {
    try {
      return await db.all("SELECT * FROM albums WHERE user_id = ? ORDER BY created_at DESC", [userId]);
    } catch (error) {
      console.error("Erreur lors de la récupération des albums de l'utilisateur:", error);
      throw error;
    }
  }

  // Récupérer un album par son ID et utilisateur
  static async getByUserAndId(id, userId) {
    try {
      return await db.get("SELECT * FROM albums WHERE id = ? AND user_id = ?", [id, userId]);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'album:", error);
      throw error;
    }
  }

  // Récupérer un album par son ID
  static async getById(id) {
    try {
      return await db.get("SELECT * FROM albums WHERE id = ?", [id]);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'album:", error);
      throw error;
    }
  }

  // Mettre à jour un album
  static async update(id, { name, description, isFavorite }) {
    try {
      await db.run(
        "UPDATE albums SET name = ?, description = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name, description, isFavorite ? 1 : 0, id]
      );
      return { id, name, description, isFavorite };
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'album:", error);
      throw error;
    }
  }

  // Supprimer un album
  static async delete(id) {
    try {
      await db.run("DELETE FROM albums WHERE id = ?", [id]);
      return true;
    } catch (error) {
      console.error("Erreur lors de la suppression de l'album:", error);
      throw error;
    }
  }

  // Ajouter un média à un album
  static async addMedia(albumId, mediaId, userId, position = null) {
    try {
      if (position === null) {
        // Si aucune position n'est spécifiée, on ajoute à la fin
        const lastPosition = await db.get(
          "SELECT MAX(position) as max_position FROM album_media WHERE album_id = ? AND user_id = ?",
          [albumId, userId]
        );
        position = (lastPosition?.max_position || 0) + 1;
      }

      await db.run(
        "INSERT OR REPLACE INTO album_media (album_id, media_id, user_id, position) VALUES (?, ?, ?, ?)",
        [albumId, mediaId, userId, position]
      );
      return true;
    } catch (error) {
      console.error("Erreur lors de l'ajout du média à l'album:", error);
      throw error;
    }
  }

  // Supprimer un média d'un album
  static async removeMedia(albumId, mediaId) {
    try {
      await db.run(
        "DELETE FROM album_media WHERE album_id = ? AND media_id = ?",
        [albumId, mediaId]
      );
      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du média de l'album:",
        error
      );
      throw error;
    }
  }

  // Supprimer un média de tous les albums
  static async removeMediaFromAllAlbums(mediaId) {
    try {
      await db.run("DELETE FROM album_media WHERE media_id = ?", [mediaId]);
      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du média des albums:",
        error
      );
      throw error;
    }
  }

  // Récupérer tous les médias d'un album
  static async getMedia(albumId) {
    try {
      return await db.all(
        `SELECT m.* FROM media m
                JOIN album_media am ON m.id = am.media_id
                WHERE am.album_id = ?
                ORDER BY am.position ASC`,
        [albumId]
      );
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des médias de l'album:",
        error
      );
      throw error;
    }
  }

  static async isFavorite(mediaId) {
    const favorites = await Album.getMedia(1);

    for (const item of favorites) {
      if (item.id == mediaId) {
        return true;
      }
    }

    return false;
  }

  // Récupérer tous les IDs des médias favoris en une seule requête
  static async getAllFavoriteIds() {
    try {
      const favorites = await db.all(
        `SELECT media_id FROM album_media WHERE album_id = 1`
      );
      return favorites.map(f => f.media_id);
    } catch (error) {
      console.error("Erreur lors de la récupération des IDs favoris:", error);
      return [];
    }
  }

  // Récupérer tous les IDs des médias favoris d'un utilisateur en une seule requête
  static async getAllFavoriteIdsByUser(userId) {
    try {
      const favorites = await db.all(
        `SELECT media_id FROM album_media WHERE album_id = 1 AND user_id = ?`
      );
      return favorites.map(f => f.media_id);
    } catch (error) {
      console.error("Erreur lors de la récupération des IDs favoris de l'utilisateur:", error);
      return [];
    }
  }

  // Marquer un album comme favori
  static async markAsFavorite(albumId, isFavorite = true) {
    try {
      await db.run(
        "UPDATE albums SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [isFavorite ? 1 : 0, albumId]
      );
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut favori:", error);
      throw error;
    }
  }

  // Récupérer tous les albums favoris
  static async getFavorites() {
    try {
      return await db.all(
        "SELECT * FROM albums WHERE is_favorite = 1 ORDER BY name"
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des favoris:", error);
      throw error;
    }
  }
}

module.exports = Album;
