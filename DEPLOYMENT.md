# Maintenance Pro V4 - Guida al Deployment

## 🚀 Opzioni di Deployment

### 1. **Google Cloud Run** (Consigliato)
Serverless, scalabile automaticamente, perfetto per questa app.

```bash
# Prerequisites
# - Google Cloud account
# - gcloud CLI installato
# - Docker installato localmente

# Login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build e deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/maintenance-pro
gcloud run deploy maintenance-pro \
  --image gcr.io/YOUR_PROJECT_ID/maintenance-pro \
  --platform managed \
  --region europe-west1 \
  --memory 512Mi \
  --timeout 3600 \
  --set-env-vars NODE_ENV=production,JWT_SECRET=your-secret-key \
  --allow-unauthenticated
```

### 2. **Replit** (Gratuito, Facile)
L'app gira già su Replit! Basta fare click su "Deploy":
- Vai su replit.com/~/@caponenext/maintenance-pro
- Click su "Deploy"
- L'app sarà disponibile a un URL Replit

### 3. **Heroku** (Easy, con limiti gratuiti ridotti)

```bash
# Prerequisites: Heroku CLI

heroku login
heroku create maintenance-pro-pro
git push heroku main

# Configura variabili di ambiente
heroku config:set JWT_SECRET=your-secret-key
heroku open
```

### 4. **Railway** (Moderno e affidabile)

```bash
# Login
railway login

# Deploy
railway init
railway up
```

### 5. **VPS Personale** (DigitalOcean, Linode, ecc.)

```bash
# Su un VPS Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install nodejs
git clone https://github.com/caponenext/maintenance-pro
cd maintenance-pro
npm install
npm start

# Per mantenere l'app in esecuzione:
sudo npm install -g pm2
pm2 start server.js --name "maintenance-pro"
pm2 startup
pm2 save
```

---

## 📋 Configurazione Necessaria

Prima del deployment, configura le variabili di ambiente:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=chiave-segreta-forte-qui

# Email (opzionale)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tua-email@gmail.com
SMTP_PASS=password-app-specifica
SMTP_FROM=Maintenance Pro <noreply@azienda.com>
```

---

## 🔐 Sicurezza in Produzione

1. **Cambia le credenziali di default**
   - Email: admin@maintenance.pro
   - Password: admin
   - ⚠️ IMPORTANTE: Modificare subito dopo il deployment

2. **Usa HTTPS**
   - Cloud Run: automatico
   - Heroku: automatico
   - VPS: usa Let's Encrypt con Certbot

3. **Backup del Database**
   - Il database SQLite è in `maintenance.db`
   - Configura backup giornalieri
   - Considera di migrare a PostgreSQL per la produzione

---

## 🐳 Docker Image

L'immagine Docker è ottimizzata per:
- Node.js 24 Alpine (lightweight)
- Memoria: 512MB
- Cold start: < 2 secondi
- Dimensione: ~200MB

---

## ✅ Verifica Post-Deployment

```bash
# Test endpoint di login
curl -X POST https://your-deployed-app.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@maintenance.pro","password":"admin"}'

# Leggi i log
# Cloud Run: gcloud run logs read maintenance-pro
# Heroku: heroku logs --tail
# PM2: pm2 monit
```

---

## 📞 Supporto

Per problemi di deployment:
- Controlla i log dell'applicazione
- Verifica che tutte le variabili di ambiente siano impostate
- Assicurati che la porta 3000 sia accessibile

Buon deployment! 🚀
