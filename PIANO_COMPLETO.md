# Maintenance Pro V4 - Piano Completo

## Analisi del File Excel

Dal file `report manutenzionetest.xls` ho estratto le seguenti informazioni chiave:

### Struttura Dati Esistente
- **Linee produzione**: LINEA SECCO, LINEA FRESCO, LINEA MESCOLAZIONE, LINEA INERTI
- **Tecnici**: VC (Vincenzo Capone), FM, FP, FB, MG, MB, MN, GC (Giancarlo Corvini)
- **Tipo manutenzione**: ORDINARIA, PROGRAMMATA, EMERGENZA
- **Stato macchina**: OK, DA TESTARE, NON FUNZIONANTE
- **Campi tracciati**:
  - Data esecuzione
  - Ore lavorate
  - Frequenza in giorni
  - Data prossima manutenzione
  - Descrizione lavori eseguiti
  - Ricambi/componenti sostituiti
  - Codice ricambio
  - Fornitore
  - Note

---

## Funzionalità Richieste

### 1. REGISTRO MANUTENZIONI COMPLETO
- [x] Storico di tutte le manutenzioni eseguite
- [x] Filtri per data, tipo, tecnico, macchina, stabilimento
- [x] Esportazione Excel/PDF
- [x] Statistiche ore lavorate per tecnico

### 2. SISTEMA ALLARMI/NOTIFICHE
- [x] Notifiche per manutenzioni programmate in scadenza
- [x] Notifiche sonore (beep/alert)
- [x] Avvisi giornalieri delle scadenze
- [x] Colori diversi per priorità (rosso=urgente, giallo=in arrivo, verde=ok)

### 3. DIVISIONE PER STABILIMENTI
- [x] Multi-stabilimento supportato
- [x] Filtro vista per stabilimento
- [x] Dashboard per ogni stabilimento

### 4. SCHEDA SEMPLICE PER MANUTENTORI
- [x] Form rapido per registrazione intervento
- [x] Selezione orario da/a con time picker
- [x] Calcolo automatico ore lavorate
- [x] Campi minimi: macchina, tipo, descrizione, ore

### 5. FOTO AL REPORT
- [x] Accesso fotocamera da browser/app
- [x] Foto prima/dopo
- [x] Annotazioni sulle foto
- [x] Compressione automatica

### 6. INVIO EMAIL REPORT
- [x] Invio report dall'utente loggato
- [x] Template email professionale
- [x] Allegati PDF/foto

---

## Architettura Database

```sql
-- Azienda/Stabilimenti
companies (id, name, address, phone, email)
plants (id, company_id, name, location, manager_name)
departments (id, plant_id, name, description)

-- Macchine
machine_categories (id, name, description)
machines (id, code, name, category_id, plant_id, department_id, 
          serial_number, manufacturer, model, year, location, 
          status, notes, qr_code)

-- Manutenzioni
maintenance_types (id, name, description, frequency_days)
maintenance_records (id, machine_id, type, scheduled_date, 
                     executed_date, technician_id, start_time, end_time,
                     work_hours, description, parts_used, 
                     status, notes, created_by)

-- Foto
maintenance_photos (id, maintenance_id, photo_type, 
                    file_path, thumbnail_path, notes, taken_at)

-- Utenti
users (id, name, email, password, role, plant_id, phone, signature_image)

-- Notifiche/Allarmi
maintenance_alerts (id, machine_id, alert_type, scheduled_date,
                    status, notified_at, resolved_at, priority)

-- Scadenze
maintenance_schedules (id, machine_id, maintenance_type_id,
                       last_execution, next_execution, frequency_days,
                       status, created_by)
```

---

## Servizi Consigliati per Replit

### Gratuiti (Replit Free Tier)
1. **Replit Deploy** - Hosting gratuito con URL pubblico
2. **SQLite** - Database integrato (persistente su Replit)
3. **Replit Secrets** - Per variabili d'ambiente sicure

### Servizi Email (Consigliati)
| Servizio | Prezzo | Vantaggi |
|----------|--------|----------|
| **SendGrid** | 100 email/giorno gratis | Affidabile, API semplice |
| **Mailgun** | 5000 email/mese gratis | Buona documentazione |
| **Gmail SMTP** | Gratis con account | Facile da configurare |

### Notifiche Push (Opzionale)
- **OneSignal** - Gratis fino a 10k utenti
- **Firebase Cloud Messaging** - Gratis illimitato

### Storage Foto
- **Cloudinary** - 25GB gratis
- **Replit Storage** - Gratis ma limitato

---

## Struttura App

### Per PC (Web)
```
Dashboard
├── Overview stabilimenti
├── Allarmi scadenze
├── Statistiche ore
└── Grafici MTBF/MTTR

Macchine
├── Lista con filtri
├── QR Code stampabili
└── Storico manutenzioni

Manutenzioni
├── Registro completo
├── Nuova manutenzione
├── Programmate
└── Esporta report

Tecnici
├── Scheda rapida intervento
├── Foto prima/dopo
└── Time tracker

Notifiche
├── Centro allarmi
├── Impostazioni alert
└── Storico notifiche
```

### Per Smartphone (PWA)
```
Home
├── Scansiona QR
├── Nuovo intervento rapido
├── Le mie manutenzioni
└── Notifiche

Intervento Rapido
├── Scansiona macchina
├── Seleziona tipo
├── Orario da/a
├── Descrizione voce/testo
├── Foto
└── Salva

Le Mie Manutenzioni
├── Lista interventi
├── Dettaglio
└── Modifica

Profilo
├── Impostazioni
├── Notifiche
└── Logout
```

---

## Stack Tecnologico

### Backend
- **Node.js** + **Express.js**
- **SQLite3** con better-sqlite3
- **JWT** per autenticazione
- **Multer** per upload foto
- **Nodemailer** per email
- **node-cron** per allarmi schedulati
- **Sharp** per compressione immagini

### Frontend
- **HTML5** + **CSS3** + **Vanilla JS**
- **Chart.js** per grafici
- **FontAwesome** per icone
- **QuaggaJS** per scansione QR
- **Web Speech API** per dettatura

### PWA
- **Service Worker** per offline
- **Web Push API** per notifiche
- **Cache API** per dati locali

---

## Colori Professionali

```css
:root {
  --primary: #2563eb;      /* Blu professionale */
  --secondary: #475569;    /* Grigio scuro */
  --success: #10b981;      /* Verde OK */
  --warning: #f59e0b;      /* Arancione da testare */
  --danger: #ef4444;       /* Rosso non funzionante */
  --info: #06b6d4;         /* Ciano info */
  --bg-dark: #0f172a;      /* Sfondo scuro */
  --bg-card: #1e293b;      /* Card scuro */
  --text: #f8fafc;         /* Testo chiaro */
  --text-muted: #94a3b8;   /* Testo secondario */
}
```

---

## Allarmi Sonori

```javascript
// Suoni di notifica
const alertSounds = {
  urgent: 'beep-urgent.mp3',      // 3 beep rapidi
  warning: 'beep-warning.mp3',    // 2 beep medi
  info: 'beep-info.mp3',          // 1 beep lungo
  success: 'success.mp3'          // Suono conferma
};

// Attivazione
- Allarme urgente: ogni 5 minuti
- Avviso warning: ogni 15 minuti  
- Notifica info: una volta al giorno
```

---

## KPI da Tracciare

1. **MTBF** (Mean Time Between Failures)
2. **MTTR** (Mean Time To Repair)
3. **Ore lavorate per tecnico**
4. **Manutenzioni per tipo**
5. **Macchine in stato NON FUNZIONANTE**
6. **Scadenze rispettate %**
7. **Costo medio manutenzione**

---

## Prossimi Passi

1. ✅ Creare questo piano
2. 🔄 Sviluppare backend completo
3. 🔄 Creare frontend web
4. 🔄 Implementare PWA mobile
5. 🔄 Aggiungere allarmi sonori
6. 🔄 Testare e deployare
