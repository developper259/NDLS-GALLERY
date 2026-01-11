# Utiliser une image Node.js officielle Alpine
FROM node:18-alpine

# Installer les dépendances système nécessaires pour Sharp et FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    vips-dev \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    bash \
    curl \
    git

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de package
COPY package*.json ./

# Installer les dépendances Node
RUN npm ci --only=production

# Copier le code source
COPY . .

# Exposer le port de l'application
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["npm", "start"]
