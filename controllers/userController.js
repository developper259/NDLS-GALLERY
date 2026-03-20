const db = require('../addon/database');

class UserController {
  /**
   * Mettre à jour la limite de stockage d'un utilisateur
   * @route PUT /api/users/storage-limit
   */
  async updateStorageLimit(req, res) {
    try {
      const { storage_limit } = req.body;
      const userId = req.user.id;

      if (!storage_limit || storage_limit < 0) {
        return res.status(400).json({
          success: false,
          message: 'Limite de stockage invalide'
        });
      }

      const result = await db.run(
        'UPDATE users SET storage_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [storage_limit, userId]
      );

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Limite de stockage mise à jour avec succès',
        storage_limit: storage_limit
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la limite de stockage:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la limite de stockage',
        error: error.message
      });
    }
  }

  /**
   * Récupérer les statistiques de stockage d'un utilisateur
   * @route GET /api/users/storage-stats
   */
  async getStorageStats(req, res) {
    try {
      const userId = req.user.id;

      const user = await db.get(
        'SELECT storage_limit FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const usage = await db.get(
        'SELECT COALESCE(SUM(file_size), 0) as used_space FROM media WHERE user_id = ? AND is_trashed = 0',
        [userId]
      );

      const trashedSpace = await db.get(
        'SELECT COALESCE(SUM(file_size), 0) as trashed_space FROM media WHERE user_id = ? AND is_trashed = 1',
        [userId]
      );

      const mediaCount = await db.get(
        'SELECT COUNT(*) as count FROM media WHERE user_id = ? AND is_trashed = 0',
        [userId]
      );

      const trashedCount = await db.get(
        'SELECT COUNT(*) as count FROM media WHERE user_id = ? AND is_trashed = 1',
        [userId]
      );

      res.json({
        success: true,
        data: {
          storage_limit: user.storage_limit,
          used_space: usage.used_space || 0,
          trashed_space: trashedSpace.trashed_space || 0,
          available_space: user.storage_limit - (usage.used_space || 0),
          media_count: mediaCount.count || 0,
          trashed_count: trashedCount.count || 0,
          usage_percentage: Math.round(((usage.used_space || 0) / user.storage_limit) * 100)
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques de stockage:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques de stockage',
        error: error.message
      });
    }
  }
}

const userController = new UserController();

module.exports = {
  updateStorageLimit: userController.updateStorageLimit.bind(userController),
  getStorageStats: userController.getStorageStats.bind(userController)
};
