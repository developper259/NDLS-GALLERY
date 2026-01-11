# NDLS Gallery - Docker Deployment

## Déploiement avec Docker Compose

### Prérequis

- Docker et Docker Compose installés sur votre NAS
- Accès SSH à votre NAS

### Installation

1. **Copiez les fichiers sur votre NAS :**

   ```bash
   # Copiez tout le répertoire du projet sur votre NAS
   scp -r /path/to/ndls-gallery user@nas:/volume1/docker/ndls-gallery
   ```

2. **Connectez-vous à votre NAS et naviguez vers le répertoire :**

   ```bash
   ssh user@nas
   cd /volume1/docker/ndls-gallery/Server
   ```

3. **Lancez l'application :**

   ```bash
   docker-compose up -d
   ```

4. **Vérifiez que l'application fonctionne :**
   ```bash
   docker-compose logs -f
   ```

### Configuration

#### Ports

- L'application sera accessible sur le port `3000` de votre NAS
- Modifiez le port dans `docker-compose.yml` si nécessaire :
  ```yaml
  ports:
    - "8080:3000" # Accès via le port 8080
  ```

#### Volumes

- `./data` : Contient la base de données SQLite et les médias
- `./config` : Contient le fichier de configuration

#### Variables d'environnement

- `NODE_ENV=production` : Mode production
- `PORT=3000` : Port interne du conteneur

### Commandes utiles

**Démarrer l'application :**

```bash
docker-compose up -d
```

**Arrêter l'application :**

```bash
docker-compose down
```

**Voir les logs :**

```bash
docker-compose logs -f
```

**Mettre à jour l'application :**

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Accéder au conteneur :**

```bash
docker-compose exec ndls-gallery sh
```

### Structure des fichiers

```
Server/
├── docker-compose.yml    # Configuration Docker Compose
├── Dockerfile            # Configuration de l'image Docker
├── .dockerignore         # Fichiers à exclure de l'image
├── package.json          # Dépendances Node.js
├── server.js             # Point d'entrée de l'application
├── config/               # Configuration de l'application
├── data/                 # Données persistantes (créé automatiquement)
└── ...                   # Autres fichiers source
```

### Dépannage

**Problèmes courants :**

1. **Port déjà utilisé :**

   - Modifiez le port externe dans `docker-compose.yml`

2. **Problèmes de permissions :**

   - Assurez-vous que l'utilisateur Docker a les droits d'écriture sur les volumes

3. **L'application ne démarre pas :**
   - Vérifiez les logs avec `docker-compose logs -f`
   - Assurez-vous que tous les fichiers nécessaires sont présents

### Sauvegarde

Pour sauvegarder vos données :

```bash
# Sauvegarder le répertoire data
tar -czf ndls-backup-$(date +%Y%m%d).tar.gz data/
```

### Mise à jour

Pour mettre à jour vers une nouvelle version :

```bash
git pull  # Si vous utilisez Git
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```
