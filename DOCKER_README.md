# Neon Classes Task Tracker — Docker Hosting & Deployment Guide

This project is fully containerized using **Docker Compose** with a multi-container microservice architecture:

| Service | Technology | Internal Port | Exposed Port | Role |
| :--- | :--- | :--- | :--- | :--- |
| **frontend** | React 19 + Vite + Nginx | 80 | `80` (or `${PORT}`) | Multi-stage production build + Nginx reverse proxy |
| **backend** | FastAPI + Python 3.12 | 8000 | `8000` | REST API, RBAC, workflows, auto-seeding |
| **mongo** | MongoDB 7 | 27017 | Internal | Database with persistent volume & healthchecks |

---

## 🚀 Quick Start (Once Docker is Installed)

From the project root directory:

```bash
# 1. (Optional) Adjust your settings in .env
cp .env.example .env

# 2. Build and start all 3 containers in detached mode
docker compose up -d --build

# 3. Check status
docker compose ps
```

Once running:
- **Application UI:** [http://localhost](http://localhost) (or `http://<your-server-ip>`)
- **Interactive API Docs (Swagger):** [http://localhost/docs](http://localhost/docs)
- **API Health Check:** [http://localhost/health](http://localhost/health)

---

## 💻 Installing Docker on Windows (Local Machine)

If Docker is not yet installed on your Windows PC:

### Option 1: Via Windows Package Manager (Terminal)
Run PowerShell as Administrator:
```powershell
# 1. Enable WSL if not already enabled
wsl --install

# 2. Install Docker Desktop
winget install Docker.DockerDesktop
```
*Note: Restart your computer when prompted to finish enabling the WSL2 virtualization features.*

### Option 2: Manual Download
1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. Run the installer and check "Use WSL 2 instead of Hyper-V".
3. Launch Docker Desktop and wait until the whale icon shows "Engine running".

---

## ☁️ Deploying on a Cloud Server / VPS (Ubuntu / Debian / AWS EC2 / DigitalOcean)

If you are hosting this on a remote Linux server:

### 1. Install Docker on your server
```bash
# Update and install Docker via the official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Enable docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Transfer or Clone your project
```bash
git clone <your-repository-url> neon_task_tracker
cd neon_task_tracker
```

### 3. Configure `.env`
```bash
cp .env.example .env
nano .env
```
> **Security Tip:** In `.env`, change `JWT_SECRET` to a strong, random key before going live.

### 4. Open Firewall Ports
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### 5. Start the Application
```bash
docker compose up -d --build
```
Your app is now live at `http://<your-server-ip>`!

---

## 🛠️ Management Commands

```bash
# View real-time logs from all containers
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo

# Stop the containers
docker compose down

# Stop containers AND delete database data (fresh start)
docker compose down -v

# Rebuild containers after code changes
docker compose up -d --build
```

---

## 🔒 Adding SSL / HTTPS (Domain Deployment)

To attach a domain with free Let's Encrypt SSL certificates, you can place Certbot / Nginx Proxy Manager or Traefik in front, or configure Certbot directly on your host machine to forward port 443 to port 80.
