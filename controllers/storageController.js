const checkDiskSpace = require('check-disk-space').default;
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config.json');
const db = require('../addon/database');

// Construire les chemins complets
const dataPath = path.join(process.cwd(), 'data');
const mediaPath = path.join(dataPath, 'media');
const trashPath = path.join(dataPath, 'trash');
const thumbsPath = path.join(dataPath, 'thumbs');
const tmpPath = path.join(dataPath, 'tmp');

// Formater la taille en unités lisibles
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Obtenir l'unité recommandée
const getRecommendedUnit = (bytes) => {
    if (bytes < 1024) return { value: bytes, unit: 'Bytes' };
    if (bytes < 1024 * 1024) return { value: bytes / 1024, unit: 'KB' };
    if (bytes < 1024 * 1024 * 1024) return { value: bytes / (1024 * 1024), unit: 'MB' };
    if (bytes < 1024 * 1024 * 1024 * 1024) return { value: bytes / (1024 * 1024 * 1024), unit: 'GB' };
    return { value: bytes / (1024 * 1024 * 1024 * 1024), unit: 'TB' };
};

// Fonction pour obtenir la taille d'un dossier récursivement
const getFolderSize = async (folderPath) => {
    let size = 0;
    try {
        if (await fs.pathExists(folderPath)) {
            const items = await fs.readdir(folderPath);
            for (const item of items) {
                const itemPath = path.join(folderPath, item);
                const stats = await fs.stat(itemPath);
                if (stats.isDirectory()) {
                    size += await getFolderSize(itemPath);
                } else {
                    size += stats.size;
                }
            }
        }
    } catch (error) {
        console.error(`Erreur lors du calcul de la taille du dossier ${folderPath}:`, error);
    }
    return size;
};

// Obtenir les statistiques de stockage
const getStorageStats = async (req, res) => {
    try {
        const userId = req.user?.id;

        // Récupérer les informations du disque
        const diskInfo = await checkDiskSpace(config.paths.disk);
        const total = diskInfo.size;
        
        // Utiliser les chemins prédéfinis
        
        // Créer les dossiers s'ils n'existent pas
        await fs.ensureDir(mediaPath);
        await fs.ensureDir(trashPath);
        await fs.ensureDir(thumbsPath);
        await fs.ensureDir(tmpPath);
        
        // Calculer la taille des dossiers
        const mediaSize = await getFolderSize(mediaPath);
        const trashSize = await getFolderSize(trashPath);
        const thumbsSize = await getFolderSize(thumbsPath);
        
        // Calculer l'espace utilisé et libre
        const used = mediaSize + trashSize + thumbsSize;
        const free = total - used;
        
        // Calculer les pourcentages
        const usedPercentage = ((used / total) * 100).toFixed(2);
        const freePercentage = ((free / total) * 100).toFixed(2);

        // Récupérer les informations de stockage utilisateur si connecté
        let userStorage = null;
        if (userId) {
            const user = await db.get(
                'SELECT storage_limit FROM users WHERE id = ?',
                [userId]
            );

            if (user) {
                const userUsage = await db.get(
                    'SELECT COALESCE(SUM(file_size), 0) as used_space FROM media WHERE user_id = ? AND is_trashed = 0',
                    [userId]
                );

                const userTrashed = await db.get(
                    'SELECT COALESCE(SUM(file_size), 0) as trashed_space FROM media WHERE user_id = ? AND is_trashed = 1',
                    [userId]
                );

                userStorage = {
                    limit: user.storage_limit,
                    used: userUsage.used_space || 0,
                    trashed: userTrashed.trashed_space || 0,
                    available: user.storage_limit - (userUsage.used_space || 0),
                    usage_percentage: Math.round(((userUsage.used_space || 0) / user.storage_limit) * 100)
                };
            }
        }
        
        // Formater les données de réponse
        const response = {
            success: true,
            user_storage: userStorage,
            disk: {
                total: {
                    bytes: userStorage ? userStorage.limit : total,
                    formatted: userStorage ? formatBytes(userStorage.limit) : formatBytes(total),
                    unit: userStorage ? getRecommendedUnit(userStorage.limit).unit : getRecommendedUnit(total).unit
                },
                used: {
                    bytes: userStorage ? userStorage.used : used,
                    formatted: userStorage ? formatBytes(userStorage.used) : formatBytes(used),
                    percentage: userStorage ? userStorage.usage_percentage : parseFloat(usedPercentage)
                },
                free: {
                    bytes: userStorage ? userStorage.available : free,
                    formatted: userStorage ? formatBytes(userStorage.available) : formatBytes(free),
                    percentage: userStorage ? (100 - userStorage.usage_percentage) : parseFloat(freePercentage)
                }
            },
            usage: {
                media: {
                    bytes: mediaSize,
                    formatted: formatBytes(mediaSize)
                },
                trash: {
                    bytes: trashSize,
                    formatted: formatBytes(trashSize)
                },
                thumbs: {
                    bytes: thumbsSize,
                    formatted: formatBytes(thumbsSize)
                },
                tmp: {
                    bytes: await getFolderSize(tmpPath),
                    formatted: formatBytes(await getFolderSize(tmpPath))
                }
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques de stockage:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques de stockage',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

// Vérifier si un chemin est un sous-dossier
const isSubfolder = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

// Obtenir les statistiques d'utilisation pour un dossier spécifique
const getFolderStats = async (folderPath) => {
    try {
        const size = await getFolderSize(folderPath);
        const stats = await fs.stat(folderPath);
        
        return {
            path: folderPath,
            size: {
                formatted: formatBytes(size)
            },
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
        };
    } catch (error) {
        console.error(`Erreur lors de la récupération des statistiques du dossier ${folderPath}:`, error);
        return {
            path: folderPath,
            error: 'Impossible de lire le dossier',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        };
    }
};

module.exports = {
    getStorageStats,
    formatBytes,
    getRecommendedUnit,
    getFolderSize,
    isSubfolder,
    getFolderStats
};
