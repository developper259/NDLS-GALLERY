const axios = require('axios');
const db = require('../addon/database');
const configndl = require('../configndl.json');

class AuthController {
  /**
   * Initier la connexion OAuth2
   * @route GET /api/auth/login
   */
  async initiateLogin(req, res) {
    try {
      const state = generateRandomState();
      
      const authUrl = new URL(configndl.oauth.ndl_client_url + configndl.oauth.endpoints.authorize);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', configndl.oauth.client_id);
      authUrl.searchParams.append('redirect_uri', configndl.oauth.redirect_uri);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('scope', configndl.oauth.scopes);
      
      res.json({ 
        success: true, 
        authUrl: authUrl.toString(),
        state: state
      });
    } catch (error) {
      console.error('Erreur lors de l\'initiation de la connexion:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de l\'initiation de la connexion',
        error: error.message 
      });
    }
  }

  /**
   * Callback OAuth2 - Échanger le code contre des tokens
   * @route POST /api/auth/callback
   */
  async handleCallback(req, res) {
    try {
      const { code, state } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Code d\'autorisation manquant' 
        });
      }
      
      const tokens = await this.exchangeCodeForTokens(code);
      
      const userData = await this.fetchUserData(tokens.access_token);
      
      const user = await this.findOrCreateUser(userData);
      
      res.json({ 
        success: true, 
        user: user,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type
        }
      });
    } catch (error) {
      console.error('Erreur lors du callback OAuth2:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de l\'authentification',
        error: error.message 
      });
    }
  }

  /**
   * Rafraîchir le token d'accès
   * @route POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ 
          success: false, 
          message: 'Refresh token manquant' 
        });
      }
      
      const response = await axios.post(
        configndl.oauth.api_base_url + configndl.oauth.endpoints.token,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh_token,
          client_id: configndl.oauth.client_id,
          client_secret: configndl.oauth.client_secret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(
              configndl.oauth.client_id + ':' + configndl.oauth.client_secret
            ).toString('base64')
          }
        }
      );
      
      res.json({ 
        success: true, 
        tokens: response.data 
      });
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors du rafraîchissement du token',
        error: error.message 
      });
    }
  }

  /**
   * Déconnexion
   * @route POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const { access_token, refresh_token } = req.body;
      
      if (refresh_token) {
        await axios.post(
          configndl.oauth.api_base_url + configndl.oauth.endpoints.logout,
          { refresh_token },
          {
            headers: {
              'Authorization': 'Bearer ' + access_token
            }
          }
        ).catch(err => console.log('Erreur lors de la révocation du token:', err.message));
      }
      
      res.json({ 
        success: true, 
        message: 'Déconnexion réussie' 
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la déconnexion',
        error: error.message 
      });
    }
  }

  /**
   * Récupérer l'utilisateur connecté
   * @route GET /api/auth/me
   */
  async getMe(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await db.get(
        'SELECT id, id_ndl, storage_limit, created_at FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'Utilisateur non trouvé' 
        });
      }
      
      res.json({ 
        success: true, 
        user: user 
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération de l\'utilisateur',
        error: error.message 
      });
    }
  }

  /**
   * Échanger le code d'autorisation contre des tokens
   */
  async exchangeCodeForTokens(code) {
    const response = await axios.post(
      configndl.oauth.api_base_url + configndl.oauth.endpoints.token,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: configndl.oauth.redirect_uri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            configndl.oauth.client_id + ':' + configndl.oauth.client_secret
          ).toString('base64')
        }
      }
    );
    
    return response.data;
  }

  /**
   * Récupérer les données utilisateur depuis NDLS Connect
   */
  async fetchUserData(accessToken) {
    const response = await axios.get(
      configndl.oauth.api_base_url + configndl.oauth.endpoints.user,
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      }
    );
    
    return response.data.data.user;
  }

  /**
   * Trouver ou créer un utilisateur dans la base de données Gallery
   */
  async findOrCreateUser(ndlUser) {
    let user = await db.get(
      'SELECT * FROM users WHERE id_ndl = ?',
      [ndlUser.id]
    );
    
    if (!user) {
      const result = await db.run(
        `INSERT INTO users (id_ndl)
         VALUES (?)`,
        [ndlUser.id]
      );
      
      user = await db.get(
        'SELECT * FROM users WHERE id = ?',
        [result.id]
      );
    }
    
    return user;
  }

  /**
   * Générer un state aléatoire pour CSRF
   */
  generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Créer un utilisateur et sauvegarder les tokens localement
   * @route   POST /api/auth/create-user
   * @access  Private
   */
  async createUserAndTokens(req, res) {
    try {
      const { access_token, refresh_token, ndl_token, expires_in, user_data } = req.body;
      const userId = req.user.id;
      
      // Sauvegarder les tokens dans la table locale
      const TokenService = require('../addon/token');
      await TokenService.saveTokens(userId, access_token, refresh_token, ndl_token, expires_in);
      
      res.json({
        success: true,
        message: 'Utilisateur et tokens créés avec succès',
        userId: userId
      });
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur et des tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'utilisateur et des tokens',
        error: error.message
      });
    }
  }
}

const authController = new AuthController();

module.exports = {
  initiateLogin: authController.initiateLogin.bind(authController),
  handleCallback: authController.handleCallback.bind(authController),
  refreshToken: authController.refreshToken.bind(authController),
  logout: authController.logout.bind(authController),
  getMe: authController.getMe.bind(authController),
  findOrCreateUser: authController.findOrCreateUser.bind(authController),
  createUserAndTokens: authController.createUserAndTokens.bind(authController)
};
