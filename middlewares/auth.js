const axios = require('axios');
const configndl = require('../configndl.json');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant ou invalide'
      });
    }
    
    const accessToken = authHeader.substring(7);
    
    try {
      const response = await axios.post(
        configndl.oauth.api_base_url + configndl.oauth.endpoints.verify,
        {},
        {
          headers: {
            'Authorization': 'Bearer ' + accessToken
          }
        }
      );
      
      if (!response.data.success) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide ou expiré'
        });
      }
      
      req.user = response.data.user;
      req.accessToken = accessToken;
      
      next();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide ou expiré'
        });
      }
      
      console.error('Erreur lors de la vérification du token:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du token'
      });
    }
  } catch (error) {
    console.error('Erreur dans le middleware d\'authentification:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

module.exports = authMiddleware;
