const db = require("./database");

class TokenService {
  // Sauvegarder les tokens pour un utilisateur
  static async saveTokens(userId, accessToken, refreshToken, tokenNdl, expiresIn) {
    try {
      // Supprimer les anciens tokens de cet utilisateur
      await this.deleteTokensByUserId(userId);
      
      // Calculer la date d'expiration
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      
      // Insérer les nouveaux tokens
      await db.run(
        `INSERT INTO tokens (user_id, access_token, refresh_token, token_ndl, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, accessToken, refreshToken, tokenNdl, expiresAt]
      );
      
      return { success: true };
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des tokens:", error);
      throw error;
    }
  }

  // Récupérer les tokens d'un utilisateur
  static async getTokensByUserId(userId) {
    try {
      const tokens = await db.all(
        `SELECT * FROM tokens WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
      return tokens;
    } catch (error) {
      console.error("Erreur lors de la récupération des tokens:", error);
      throw error;
    }
  }

  // Récupérer le token valide le plus récent
  static async getValidToken(userId) {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const token = await db.get(
        `SELECT * FROM tokens 
         WHERE user_id = ? AND expires_at > ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId, currentTime]
      );
      return token;
    } catch (error) {
      console.error("Erreur lors de la récupération du token valide:", error);
      throw error;
    }
  }

  // Supprimer les tokens d'un utilisateur
  static async deleteTokensByUserId(userId) {
    try {
      await db.run("DELETE FROM tokens WHERE user_id = ?", [userId]);
      return { success: true };
    } catch (error) {
      console.error("Erreur lors de la suppression des tokens:", error);
      throw error;
    }
  }

  // Supprimer un token spécifique
  static async deleteToken(tokenId) {
    try {
      await db.run("DELETE FROM tokens WHERE id = ?", [tokenId]);
      return { success: true };
    } catch (error) {
      console.error("Erreur lors de la suppression du token:", error);
      throw error;
    }
  }

  // Vérifier si un token est valide
  static async isTokenValid(accessToken) {
    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const token = await db.get(
        `SELECT * FROM tokens WHERE access_token = ? AND expires_at > ? LIMIT 1`,
        [accessToken, currentTime]
      );
      return !!token;
    } catch (error) {
      console.error("Erreur lors de la validation du token:", error);
      return false;
    }
  }

  // Rafraîchir un token
  static async refreshToken(userId, newAccessToken, newRefreshToken, expiresIn) {
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      
      await db.run(
        `UPDATE tokens 
         SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [newAccessToken, newRefreshToken, expiresAt, userId]
      );
      
      return { success: true };
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du token:", error);
      throw error;
    }
  }
}

module.exports = TokenService;
