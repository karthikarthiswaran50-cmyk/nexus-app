#!/usr/bin/env bash
# ==============================================================================
# Nexus Production VPS Deployment Script (Ubuntu 22.04 / 24.04)
# Automates Docker, Docker Compose, SSL Certificates, and App Startup
# ==============================================================================

set -e

echo "🚀 Starting Nexus Production Deployment..."

# 1. Update system packages
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw apt-transport-https ca-certificates gnupg lsb-release

# 2. Install Docker & Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo apt-get install -y docker-compose-plugin docker-compose
fi

# 3. Configure Firewall (UFW)
echo "🔒 Configuring Firewall rules..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:49200/udp
sudo ufw --force enable

# 4. Generate local SSL certs for Nginx if not exists
mkdir -p nginx/ssl nginx/certbot
if [ ! -f nginx/ssl/server.key ]; then
    echo "🔑 Generating default SSL certificates for Nginx..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/server.key \
        -out nginx/ssl/server.cert \
        -subj "/C=US/ST=State/L=City/O=Nexus/OU=WebRTC/CN=localhost"
fi

# 5. Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating default .env file from template..."
    cp .env.example .env
fi

# 6. Build and Start Docker Services
echo "🐳 Building and starting all Docker containers..."
docker-compose up -d --build

echo "
==============================================================================
🎉 NEXUS IS NOW RUNNING IN PRODUCTION!
==============================================================================
🌐 HTTP / HTTPS:  https://YOUR_DOMAIN_OR_SERVER_IP
📡 WebRTC TURN:  turn:YOUR_SERVER_IP:3478
🗄️ PostgreSQL:    localhost:5432 (inside docker network)

To view live logs:
  docker-compose logs -f nexus-app
==============================================================================
"
