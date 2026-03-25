# 🔧 Maintenance Pro V4

**Gestione Manutenzioni Industriale Completa** - Registro manutenzioni, allarmi scadenze, foto, notifiche sonore, multi-stabilimento.

---

## ✨ Funzionalità Principali

### 📋 Registro Manutenzioni Completo
- Storico di tutte le manutenzioni eseguite
- Tracciamento ore lavorate per tecnico
- Filtri avanzati (data, tipo, tecnico, macchina, stabilimento)
- Esportazione Excel/PDF
- Statistiche e KPI

### 🚨 Sistema Allarmi e Notifiche Sonore
- **Allarmi visivi** per manutenzioni scadute (rosso)
- **Avvisi** per scadenze imminenti (giallo)
- **Notifiche sonore** configurabili
- Banner allarme in dashboard
- Badge contatore allarmi

### 🏭 Divisione per Stabilimenti
- Multi-azienda e multi-stabilimento
- Filtro vista per stabilimento
- Dashboard separate
- Gestione reparti

### 📱 Scheda Semplice per Manutentori
- Form rapido "Intervento Rapido"
- Selezione orario da/a con time picker
- Calcolo automatico ore lavorate
- Input vocale per descrizione
- Accesso diretto dalla home

### 📸 Foto al Report
- Scatta foto dalla fotocamera
- Carica foto esistenti
- Foto multiple per intervento
- Thumbnail e visualizzazione
- Compressione automatica

### 📧 Invio Email Report
- Invio report dall'utente loggato
- Template email professionale
- Allegati PDF/foto incluse
- Configurazione SMTP personalizzabile

---

## 🚀 Deploy su Replit

### Passo 1: Crea Account e Repl
1. Vai su [replit.com](https://replit.com) e crea un account gratuito
2. Clicca **"Create"** → **"Template"** → seleziona **"Node.js"**
3. Dai un nome al progetto (es. "maintenance-pro-v4")

### Passo 2: Carica i File
1. Estrai l'archivio `maintenance-pro-v4.tar.gz`
2. In Replit, clicca sui tre puntini (...) nel file manager
3. Seleziona **"Upload files/folders"**
4. Carica tutti i file e cartelle:
   - `server.js`
   - `package.json`
   - `.replit`
   - Cartella `public/`

### Passo 3: Installa Dipendenze
Nel tab "Shell" di Replit, esegui:
```bash
npm install
```

### Passo 4: Configura Secrets (Variabili d'Ambiente)
1. Clicca l'icona **🔒 Secrets** nel pannello a sinistra
2. Aggiungi queste variabili:

```
JWT_SECRET = "la-tua-chiave-segreta-super-sicura-123"
```

### Passo 5: Avvia l'App
1. Clicca il pulsante **"Run"** in alto
2. L'app sarà disponibile all'URL mostrato (es. `https://maintenance-pro-v4.tuo-username.repl.co`)

---

## 📧 Configurazione Email (Opzionale)

Per inviare report via email, configura il tuo provider SMTP:

### Gmail
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = tua-email@gmail.com
SMTP_PASS = xxxx-xxxx-xxxx-xxxx (Password App)
SMTP_FROM = tua-email@gmail.com
```

**Nota**: Per Gmail devi generare una "Password per le app" nelle impostazioni di sicurezza.

### SendGrid (Consigliato - Gratis)
1. Registrati su [sendgrid.com](https://sendgrid.com) (100 email/giorno gratis)
2. Crea una API Key
3. Configura:
```
SMTP_HOST = smtp.sendgrid.net
SMTP_PORT = 587
SMTP_USER = apikey
SMTP_PASS = la-tua-api-key
SMTP_FROM = noreply@tua-azienda.com
```

---

## 👤 Accesso Default

| Email | Password | Ruolo |
|-------|----------|-------|
| admin@maintenance.pro | admin | Amministratore |

**⚠️ Importante**: Cambia la password alla prima login!

---

## 📱 Installazione su Smartphone (PWA)

### Android (Chrome)
1. Apri l'app nel browser Chrome
2. Tocca i **tre puntini** → **"Aggiungi a schermata Home"**
3. L'app verrà installata come applicazione nativa

### iOS (Safari)
1. Apri l'app in Safari
2. Tocca **Condividi** → **"Aggiungi a Home"**
3. L'app verrà aggiunta alla home screen

### Funzionalità PWA
- ✅ Icona sulla home screen
- ✅ Schermo a tutto schermo
- ✅ Accesso fotocamera
- ✅ Funzionamento offline (base)
- ✅ Notifiche (se abilitate)

---

## 🗄️ Struttura Database

```
companies          → Aziende
plants             → Stabilimenti  
departments        → Reparti
machine_categories → Categorie macchine
machines           → Macchine/Impianti
maintenance_types  → Tipi manutenzione
users              → Utenti (admin/technician/manager)
maintenance_records→ Registro manutenzioni
maintenance_photos → Foto interventi
maintenance_schedules → Scadenze programmate
maintenance_alerts → Allarmi notifiche
email_settings     → Configurazione SMTP
```

---

## 🎨 Colori e Stati

| Stato | Colore | Significato |
|-------|--------|-------------|
| OK | 🟢 Verde | Macchina funzionante |
| DA_TESTARE | 🟡 Giallo | Richiede verifica |
| NON_FUNZIONANTE | 🔴 Rosso | Fuori servizio |

| Priorità Allarme | Colore | Azione |
|------------------|--------|--------|
| Urgente | 🔴 Rosso | Manutenzione scaduta |
| Alta | 🟠 Arancione | Scade in 3 giorni |
| Media | 🔵 Blu | Scade in 7 giorni |
| Bassa | 🟢 Verde | Programmata |

---

## 🔌 API Endpoints

### Autenticazione
- `POST /api/login` - Login utente
- `GET /api/verify-token` - Verifica token

### Macchine
- `GET /api/machines` - Lista macchine
- `POST /api/machines` - Crea macchina
- `PUT /api/machines/:id` - Aggiorna macchina
- `DELETE /api/machines/:id` - Elimina macchina

### Manutenzioni
- `GET /api/maintenance` - Lista manutenzioni
- `POST /api/maintenance` - Registra manutenzione
- `GET /api/maintenance/:id` - Dettaglio manutenzione
- `DELETE /api/maintenance/:id` - Elimina manutenzione

### Foto
- `POST /api/maintenance/:id/photos` - Carica foto
- `GET /api/maintenance/:id/photos` - Lista foto

### Allarmi
- `GET /api/alerts` - Lista allarmi
- `GET /api/alerts/dashboard` - Allarmi per dashboard

### Scadenze
- `GET /api/schedules` - Lista scadenze
- `POST /api/schedules` - Crea scadenza

### Statistiche
- `GET /api/stats` - Statistiche dashboard

### Email
- `GET /api/email-settings` - Impostazioni email
- `PUT /api/email-settings` - Salva impostazioni
- `POST /api/send-report` - Invia report

### Export
- `GET /api/export/maintenance` - Esporta Excel

---

## 🛠️ Stack Tecnologico

### Backend
- **Node.js** 18+ - Runtime JavaScript
- **Express.js** - Web framework
- **better-sqlite3** - Database SQLite
- **bcryptjs** - Hashing password
- **jsonwebtoken** - Autenticazione JWT
- **multer** - Upload file
- **sharp** - Elaborazione immagini
- **nodemailer** - Invio email
- **node-cron** - Job schedulati

### Frontend
- **HTML5** + **CSS3** - Struttura e stile
- **Vanilla JavaScript** - Logica client
- **Chart.js** - Grafici e statistiche
- **FontAwesome** - Icone
- **Web Speech API** - Input vocale

---

## 📋 Lista Cose Necessarie

### Per Replit (Gratis)
- [ ] Account Replit (gratuito)
- [ ] Progetto Node.js
- [ ] File dell'app caricati
- [ ] Dipendenze installate (`npm install`)
- [ ] Secrets configurati (JWT_SECRET)

### Per Email (Opzionale)
- [ ] Account Gmail o SendGrid
- [ ] Password App (per Gmail)
- [ ] Secrets SMTP configurati

### Per Smartphone
- [ ] Browser Chrome (Android) o Safari (iOS)
- [ ] Aggiungi a schermata home
- [ ] Permessi fotocamera (quando richiesto)

---

## 🎯 Utilizzo Quotidiano

### Per il Tecnico
1. Accedi con le tue credenziali
2. Vai su **"Intervento Rapido"**
3. Seleziona la macchina e inserisci orari
4. Descrivi i lavori (anche a voce)
5. Scatta foto se necessario
6. Salva l'intervento

### Per il Manager
1. Controlla la **Dashboard** per overview
2. Verifica **Allarmi** per scadenze
3. Esporta report in Excel
4. Invia report via email

### Per l'Amministratore
1. Gestisci utenti e permessi
2. Configura stabilimenti e macchine
3. Imposta scadenze programmate
4. Configura email SMTP

---

## 🔧 Risoluzione Problemi

### "Errore di connessione"
- Verifica che il server sia avviato (pulsante Run)
- Controlla la connessione internet

### "Credenziali non valide"
- Default: admin@maintenance.pro / admin
- Verifica maiuscole/minuscole

### "Fotocamera non funziona"
- Concedi i permessi quando richiesto
- Usa HTTPS (su Replit è automatico)
- Su iOS usa Safari

### "Email non inviate"
- Verifica configurazione SMTP
- Controlla spam/promozioni
- Verifica password app (Gmail)

---

## 📞 Supporto

Per problemi o domande:
1. Controlla la console del browser (F12)
2. Verifica i log in Replit (tab Console)
3. Ricarica la pagina (Ctrl+F5)

---

## 📄 Licenza

MIT License - Libero utilizzo per uso commerciale e personale.

---

**© 2024 Maintenance Pro V4 - Industrial Maintenance Management**

Sviluppato con ❤️ per la manutenzione industriale.
