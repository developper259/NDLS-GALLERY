const axios = require('axios');
const db = require('../addon/database');
const TokenService = require('../addon/token');
const ndlsConfig = require('../config/ndls.json');

// Fonction de log avec timestamp
const logAuth = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
};

/**
 * Middleware d'authentification pour le serveur
 * Vérifie le token Bearer et récupère l'utilisateur connecté
 */
const authenticateToken = async (req, res, next) => {
  const startTime = Date.now();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAuth('WARN', 'Missing or invalid Bearer token', {
        method,
        url,
        tokenLength: authHeader ? authHeader.length : 0
      });
      
      logAuth('ERROR', 'Authentication middleware failed', {
        error: 'Missing or invalid Bearer token',
        method,
        url,
        duration: Date.now() - startTime,
        ip
      });
      
      // Envoyer une réponse spécifique pour indiquer au client de déconnecter
      return res.status(401).json({ 
        success: false, 
        error: 'INVALID_TOKEN',
        message: 'Token manquant ou invalide',
        action: 'LOGOUT'
      });
    }
    
    const token = authHeader.substring(7);
    
    logAuth('INFO', 'Token validation started', {
      method,
      url,
      tokenLength: token.length
    });
    
    // Vérifier le token dans la table locale
    try {
      const isValidLocalToken = await TokenService.isTokenValid(token);
      
      logAuth('INFO', 'Token validation check', {
        tokenLength: token.length,
        tokenStart: token.substring(0, 20) + '...',
        isValidLocal: isValidLocalToken
      });
      
      if (isValidLocalToken) {
        // Token valide localement, récupérer l'utilisateur associé
        logAuth('INFO', 'Local token validation successful');
        
        const tokenRecord = await db.get(
          `SELECT t.*, u.id_ndl, u.created_at as user_created_at, u.updated_at as user_updated_at
           FROM tokens t
           JOIN users u ON t.user_id = u.id
           WHERE t.access_token = ? AND t.expires_at > ? 
           LIMIT 1`,
          [token, Math.floor(Date.now() / 1000)]
        );
        
        if (tokenRecord) {
          logAuth('INFO', 'Authentication successful with local token', {
            userId: tokenRecord.user_id,
            idNdl: tokenRecord.id_ndl,
            expiresAt: tokenRecord.expires_at,
            duration: Date.now() - startTime
          });
          
          // Ajouter l'utilisateur à la requête
          req.user = {
            id: tokenRecord.user_id,
            id_ndl: tokenRecord.id_ndl,
            created_at: tokenRecord.user_created_at,
            updated_at: tokenRecord.user_updated_at
          };
          
          next();
        } else {
          logAuth('WARN', 'Token found but user record missing', {
            tokenLength: token.length
          });
          
          logAuth('ERROR', 'Authentication middleware failed', {
            error: 'User record missing',
            method,
            url,
            duration: Date.now() - startTime,
            ip
          });
          
          return res.status(401).json({ 
            success: false, 
            error: 'INVALID_TOKEN',
            message: 'Token invalide',
            action: 'LOGOUT'
          });
        }
      } else {
        // Token non trouvé ou expiré localement, vérifier auprès de NDLS Connect
        logAuth('INFO', 'Local token not found or expired, checking with NDLS Connect', {
          tokenLength: token.length,
          tokenStart: token.substring(0, 20) + '...'
        });
        
        const response = await axios.get(ndlsConfig.api_url + 'users/me', {
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 200 && response.data.data.user) {
          const ndlUser = response.data.data.user;
          
          logAuth('INFO', 'NDLS user retrieved successfully', {
            userId: ndlUser.id,
            email: ndlUser.email,
            username: ndlUser.username
          });
          
          // Trouver ou créer l'utilisateur dans la base de données locale
          let user = await db.get(
            'SELECT * FROM users WHERE id_ndl = ?',
            [ndlUser.id]
          );
          
          if (!user) {
            logAuth('INFO', 'Local user not found, creating new user', {
              idNdl: ndlUser.id,
              email: ndlUser.email
            });
            
            // Créer l'utilisateur s'il n'existe pas
            const result = await db.run(
              'INSERT INTO users (id_ndl) VALUES (?)',
              [ndlUser.id]
            );
            
            user = await db.get(
              'SELECT * FROM users WHERE id = ?',
              [result.id]
            );
            
            logAuth('INFO', 'Local user created successfully', {
              userId: user.id,
              idNdl: user.id_ndl
            });
            
            // Créer l'album favoris pour le nouvel utilisateur
            try {
              const Album = require('../addon/album');
              await Album.create({
                name: "Favoris",
                id: Album.favoriteAlbumId,
                description: "Album des images favorites",
                isFavorite: true,
                userId: user.id
              });
              
              logAuth('INFO', 'Favorite album created for new user', {
                userId: user.id,
                albumId: Album.favoriteAlbumId
              });
            } catch (albumError) {
              logAuth('ERROR', 'Failed to create favorite album for new user', {
                userId: user.id,
                error: albumError.message
              });
              // Ne pas bloquer l'authentification si l'album favoris échoue
            }
          } else {
            logAuth('INFO', 'Local user found', {
              userId: user.id,
              idNdl: user.id_ndl
            });
            
            // Vérifier si l'utilisateur a un album favoris, sinon le créer
            try {
              const Album = require('../addon/album');
              const existingAlbum = await Album.getByUserAndId(Album.favoriteAlbumId, user.id);
              
              if (!existingAlbum) {
                await Album.create({
                  name: "Favoris",
                  id: Album.favoriteAlbumId,
                  description: "Album des images favorites",
                  isFavorite: true,
                  userId: user.id
                });
                
                logAuth('INFO', 'Favorite album created for existing user', {
                  userId: user.id,
                  albumId: Album.favoriteAlbumId
                });
              }
            } catch (albumError) {
              logAuth('ERROR', 'Failed to check/create favorite album', {
                userId: user.id,
                error: albumError.message
              });
              // Ne pas bloquer l'authentification
            }
          }
          
          // Créer un token local pour éviter les futures vérifications auprès de NDLS
          // Le token reçu du client est celui de NDLS Connect, on le stocke comme référence
          const tokenNdl = token; // Token NDLS original
          const galleryToken = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          await TokenService.saveTokens(
            user.id,
            galleryToken, // access token Gallery (nouveau token généré)
            galleryToken, // refresh token Gallery (pour l'instant on utilise le même)
            tokenNdl, // token NDL pour référence
            3600 // 1 heure d'expiration pour le token local
          );
          
          logAuth('INFO', 'Local token created successfully', {
            userId: user.id,
            galleryToken: galleryToken,
            tokenNdl: tokenNdl
          });
          
          // Retourner le nouveau token Gallery au client pour qu'il l'utilise
          logAuth('INFO', 'Returning new Gallery token to client', {
            userId: user.id,
            galleryToken: galleryToken
          });
          
          return res.status(200).json({
            success: true,
            message: 'Authentication successful, new token issued',
            gallery_token: galleryToken,
            user: user
          });
        } else {
          logAuth('WARN', 'Invalid response from NDLS Connect', {
            status: response.status,
            hasData: !!response.data
          });
          
          logAuth('ERROR', 'Authentication middleware failed', {
            error: 'Invalid response from NDLS Connect',
            method,
            url,
            duration: Date.now() - startTime,
            ip
          });
          
          return res.status(401).json({ 
            success: false, 
            error: 'INVALID_TOKEN',
            message: 'Token invalide',
            action: 'LOGOUT'
          });
        }
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logAuth('WARN', 'Token expired or invalid', {
          method,
          url,
          tokenLength: token.length,
          status: error.response.status
        });
        
        logAuth('ERROR', 'Authentication middleware failed', {
          error: 'Token expired or invalid',
          method,
          url,
          duration: Date.now() - startTime,
          ip
        });
        
        return res.status(401).json({ 
          success: false, 
          error: 'INVALID_TOKEN',
          message: 'Token expiré ou invalide',
          action: 'LOGOUT'
        });
      }
      
      logAuth('ERROR', 'Error calling NDLS Connect API', {
        error: error.message,
        status: error.response?.status,
        method,
        url,
        duration: Date.now() - startTime
      });
      
      logAuth('ERROR', 'Authentication middleware failed', {
        error: 'Error calling NDLS Connect API',
        method,
        url,
        duration: Date.now() - startTime,
        ip
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'AUTH_ERROR',
        message: 'Erreur lors de l\'authentification',
        action: 'LOGOUT'
      });
    }
  } catch (error) {
    logAuth('ERROR', 'Unexpected error in authentication middleware', {
      error: error.message,
      method,
      url,
      duration: Date.now() - startTime,
      ip
    });
    
    return res.status(500).json({ 
      success: false, 
      error: 'SERVER_ERROR',
      message: 'Erreur serveur',
      action: 'LOGOUT'
    });
  }
};

module.exports = authenticateToken;
