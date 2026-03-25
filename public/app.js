// Maintenance Pro V4 - Main Application
// Gestione Manutenzioni Industriale con Allarmi, Foto, Notifiche

const API_URL = '';
let authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || 'null');
let currentPage = 'dashboard';
let selectedPhotos = [];
let currentMaintenanceId = null;
let charts = {};

// Audio Context per suoni
let audioContext = null;

// ==================== INIZIALIZZAZIONE ====================

document.addEventListener('DOMContentLoaded', async () => {
  // Inizializza date default
  document.getElementById('quick-date').valueAsDate = new Date();
  document.getElementById('maintenance-date').valueAsDate = new Date();
  
  // Verifica autenticazione
  if (authToken && currentUser) {
    const valid = await validateToken();
    if (valid) {
      showApp();
    } else {
      showLogin();
    }
  } else {
    showLogin();
  }

  // Event listeners
  document.getElementById('login-form').addEventListener('submit', login);
  
  // Chiudi modal al click fuori
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Verifica allarmi ogni minuto
  setInterval(checkAndPlayAlerts, 60000);
  
  // Inizializza audio context al primo click
  document.addEventListener('click', initAudioContext, { once: true });
});

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// ==================== AUTHENTICAZIONE ====================

async function login(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const rememberMe = document.getElementById('remember-me').checked;
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accesso...';
  
  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      authToken = data.token;
      currentUser = data.user;
      
      if (rememberMe) {
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      } else {
        sessionStorage.setItem('authToken', authToken);
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      showToast('Accesso effettuato!', 'success');
      showApp();
    } else {
      showToast(data.error || 'Credenziali non valide', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Accedi';
  }
}

async function validateToken() {
  try {
    const response = await fetch(`${API_URL}/api/verify-token`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('currentUser');
  showLogin();
}

function togglePassword() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('eye-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// ==================== NAVIGAZIONE ====================

function showLogin() {
  document.getElementById('login-page').classList.add('active');
  document.getElementById('app').classList.remove('active');
}

function showApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('app').classList.add('active');
  
  // Aggiorna UI utente
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-role').textContent = 
    currentUser.role === 'admin' ? 'Amministratore' : 
    currentUser.role === 'manager' ? 'Manager' : 'Tecnico';
  
  // Mostra elementi admin
  if (currentUser.role === 'admin') {
    document.body.classList.add('is-admin');
  }
  
  // Carica dati iniziali
  loadDashboardData();
  loadSelectOptions();
  checkAndPlayAlerts();
}

function showPage(page) {
  currentPage = page;
  
  // Nascondi tutte le pagine
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // Mostra pagina selezionata
  document.getElementById(`page-${page}`).classList.add('active');
  
  // Aggiorna nav
  const navItem = document.querySelector(`.nav-item[onclick="showPage('${page}')"]`);
  if (navItem) navItem.classList.add('active');
  
  // Carica dati pagina
  switch(page) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'alerts':
      loadAlerts();
      break;
    case 'machines':
      loadMachines();
      break;
    case 'maintenance':
      loadMaintenance();
      break;
    case 'quick-entry':
      loadQuickEntryOptions();
      break;
    case 'schedules':
      loadSchedules();
      break;
    case 'users':
      loadUsers();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ==================== DASHBOARD ====================

async function loadDashboardData() {
  try {
    // Statistiche
    const statsRes = await fetch(`${API_URL}/api/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (statsRes.ok) {
      const stats = await statsRes.json();
      updateStats(stats);
      updateCharts(stats);
    }
    
    // Allarmi dashboard
    const alertsRes = await fetch(`${API_URL}/api/alerts/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (alertsRes.ok) {
      const alerts = await alertsRes.json();
      updateDashboardAlerts(alerts);
      updateAlertBadge(alerts.length);
    }
    
    // Ultime manutenzioni
    const maintRes = await fetch(`${API_URL}/api/maintenance?limit=5`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (maintRes.ok) {
      const maintenance = await maintRes.json();
      updateRecentMaintenance(maintenance);
    }
  } catch (error) {
    console.error('Errore caricamento dashboard:', error);
  }
}

function updateStats(stats) {
  document.getElementById('stat-machines').textContent = stats.totalMachines || 0;
  document.getElementById('stat-ok').textContent = stats.machinesByStatus?.OK || 0;
  document.getElementById('stat-warning').textContent = stats.machinesByStatus?.DA_TESTARE || 0;
  document.getElementById('stat-error').textContent = stats.machinesByStatus?.NON_FUNZIONANTE || 0;
  document.getElementById('stat-maintenance').textContent = stats.totalMaintenance || 0;
  document.getElementById('stat-hours').textContent = (stats.totalWorkHours || 0).toFixed(1);
}

function updateCharts(stats) {
  // Chart stato macchine
  const machinesCtx = document.getElementById('machines-chart');
  if (machinesCtx) {
    if (charts.machines) charts.machines.destroy();
    
    charts.machines = new Chart(machinesCtx, {
      type: 'doughnut',
      data: {
        labels: ['OK', 'Da Testare', 'Non Funzionanti'],
        datasets: [{
          data: [
            stats.machinesByStatus?.OK || 0,
            stats.machinesByStatus?.DA_TESTARE || 0,
            stats.machinesByStatus?.NON_FUNZIONANTE || 0
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#f8fafc' } }
        }
      }
    });
  }
  
  // Chart tipo manutenzioni
  const typeCtx = document.getElementById('maintenance-type-chart');
  if (typeCtx) {
    if (charts.types) charts.types.destroy();
    
    charts.types = new Chart(typeCtx, {
      type: 'bar',
      data: {
        labels: ['Ordinaria', 'Programmata', 'Emergenza'],
        datasets: [{
          label: 'Manutenzioni',
          data: [
            stats.maintenanceByType?.ordinary || 0,
            stats.maintenanceByType?.scheduled || 0,
            stats.maintenanceByType?.emergency || 0
          ],
          backgroundColor: ['#06b6d4', '#8b5cf6', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
          x: { ticks: { color: '#94a3b8' } }
        }
      }
    });
  }
}

function updateDashboardAlerts(alerts) {
  const container = document.getElementById('dashboard-alerts');
  const banner = document.getElementById('alert-banner');
  
  if (alerts.length === 0) {
    container.innerHTML = '<p class="empty-state"><i class="fas fa-check-circle"></i><br>Nessun allarme attivo</p>';
    banner.classList.add('hidden');
    return;
  }
  
  // Mostra banner se ci sono allarmi urgenti
  const urgentAlerts = alerts.filter(a => a.priority === 'urgent');
  if (urgentAlerts.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('alert-message').textContent = 
      `${urgentAlerts.length} manutenzione/i scaduta/e!`;
  }
  
  container.innerHTML = alerts.slice(0, 5).map(alert => `
    <div class="alert-item ${alert.priority}">
      <i class="fas ${alert.alert_type === 'overdue' ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
      <div class="alert-content">
        <h4>${alert.machine_code} - ${alert.machine_name}</h4>
        <p>${alert.maintenance_type_name || 'Manutenzione'} - ${formatDate(alert.due_date)}</p>
      </div>
      <span class="alert-date">${alert.days_overdue > 0 ? '+' + Math.floor(alert.days_overdue) + ' gg' : 'In arrivo'}</span>
    </div>
  `).join('');
}

function updateRecentMaintenance(maintenance) {
  const tbody = document.querySelector('#recent-maintenance-table tbody');
  
  if (maintenance.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nessuna manutenzione recente</td></tr>';
    return;
  }
  
  tbody.innerHTML = maintenance.map(m => `
    <tr>
      <td>${formatDate(m.executed_date)}</td>
      <td><strong>${m.machine_code}</strong><br><small>${m.machine_name}</small></td>
      <td><span class="badge badge-${m.type}">${getTypeLabel(m.type)}</span></td>
      <td>${m.technician_name || '-'}</td>
      <td>${m.work_hours ? m.work_hours.toFixed(2) : '-'}</td>
      <td>
        <button class="btn btn-icon" onclick="viewMaintenance(${m.id})">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateAlertBadge(count) {
  const badge = document.getElementById('alert-badge');
  const dot = document.getElementById('notification-dot');
  
  badge.textContent = count;
  badge.style.display = count > 0 ? 'block' : 'none';
  
  if (count > 0) {
    dot.classList.add('active');
  } else {
    dot.classList.remove('active');
  }
}

// ==================== ALLARMI E SUONI ====================

async function checkAndPlayAlerts() {
  try {
    const response = await fetch(`${API_URL}/api/alerts/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const alerts = await response.json();
    updateAlertBadge(alerts.length);
    
    // Verifica se suoni sono abilitati
    const soundEnabled = document.getElementById('sound-enabled')?.checked ?? true;
    if (!soundEnabled) return;
    
    // Riproduci suoni in base alla priorità
    const urgentAlerts = alerts.filter(a => a.priority === 'urgent');
    const highAlerts = alerts.filter(a => a.priority === 'high');
    
    if (urgentAlerts.length > 0) {
      playAlertSound('urgent');
    } else if (highAlerts.length > 0) {
      playAlertSound('warning');
    }
  } catch (error) {
    console.error('Errore verifica allarmi:', error);
  }
}

function playAlertSound(type) {
  if (!audioContext) return;
  
  const volume = (document.getElementById('sound-volume')?.value || 80) / 100;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'urgent':
      // 3 beep rapidi
      playBeepPattern(oscillator, gainNode, volume, [200, 200, 200], 100);
      break;
    case 'warning':
      // 2 beep medi
      playBeepPattern(oscillator, gainNode, volume, [400, 400], 200);
      break;
    case 'success':
      // 1 beep lungo
      playBeepPattern(oscillator, gainNode, volume, [600], 300);
      break;
  }
}

function playBeepPattern(oscillator, gainNode, volume, frequencies, duration) {
  let index = 0;
  
  function playNext() {
    if (index >= frequencies.length) {
      oscillator.stop();
      return;
    }
    
    oscillator.frequency.value = frequencies[index];
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
    
    index++;
    setTimeout(playNext, duration + 100);
  }
  
  oscillator.start();
  playNext();
}

function playTestSound() {
  initAudioContext();
  playAlertSound('urgent');
  setTimeout(() => playAlertSound('warning'), 1000);
  setTimeout(() => playAlertSound('success'), 2000);
}

function checkAlerts() {
  checkAndPlayAlerts();
  showToast('Allarmi verificati', 'info');
}

// ==================== MACCHINE ====================

async function loadMachines() {
  try {
    const response = await fetch(`${API_URL}/api/machines`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const machines = await response.json();
    renderMachinesTable(machines);
  } catch (error) {
    console.error('Errore caricamento macchine:', error);
  }
}

function renderMachinesTable(machines) {
  const tbody = document.querySelector('#machines-table tbody');
  
  if (machines.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nessuna macchina trovata</td></tr>';
    return;
  }
  
  tbody.innerHTML = machines.map(m => `
    <tr>
      <td><strong>${m.code}</strong></td>
      <td>${m.name}</td>
      <td>${m.category_name || '-'}</td>
      <td>${m.plant_name || '-'}</td>
      <td><span class="status-badge status-${m.status.toLowerCase().replace('_', '-')}">${getStatusLabel(m.status)}</span></td>
      <td>${m.last_maintenance ? formatDate(m.last_maintenance) : '-'}</td>
      <td>
        <button class="btn btn-icon" onclick="viewMachine(${m.id})"><i class="fas fa-eye"></i></button>
        ${currentUser.role === 'admin' ? `
          <button class="btn btn-icon" onclick="editMachine(${m.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-icon" onclick="deleteMachine(${m.id})"><i class="fas fa-trash"></i></button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function filterMachines() {
  const search = document.getElementById('machine-search').value;
  const plant = document.getElementById('filter-plant').value;
  const status = document.getElementById('filter-status').value;
  
  // Ricarica con filtri
  loadMachinesWithFilters({ search, plant, status });
}

async function loadMachinesWithFilters(filters) {
  try {
    const params = new URLSearchParams();
    if (filters.plant) params.append('plant_id', filters.plant);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    
    const response = await fetch(`${API_URL}/api/machines?${params}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const machines = await response.json();
      renderMachinesTable(machines);
    }
  } catch (error) {
    console.error('Errore filtro macchine:', error);
  }
}

function openMachineModal(machineId = null) {
  document.getElementById('machine-modal-title').textContent = machineId ? 'Modifica Macchina' : 'Nuova Macchina';
  document.getElementById('machine-form').reset();
  document.getElementById('machine-id').value = '';
  
  loadMachineFormOptions();
  
  if (machineId) {
    // Carica dati macchina
    fetch(`${API_URL}/api/machines/${machineId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(r => r.json())
    .then(m => {
      document.getElementById('machine-id').value = m.id;
      document.getElementById('machine-code').value = m.code;
      document.getElementById('machine-name').value = m.name;
      document.getElementById('machine-category').value = m.category_id || '';
      document.getElementById('machine-plant').value = m.plant_id || '';
      document.getElementById('machine-department').value = m.department_id || '';
      document.getElementById('machine-serial').value = m.serial_number || '';
      document.getElementById('machine-manufacturer').value = m.manufacturer || '';
      document.getElementById('machine-model').value = m.model || '';
      document.getElementById('machine-year').value = m.year || '';
      document.getElementById('machine-location').value = m.location || '';
      document.getElementById('machine-status').value = m.status;
      document.getElementById('machine-notes').value = m.notes || '';
    });
  }
  
  document.getElementById('machine-modal').classList.add('active');
}

async function loadMachineFormOptions() {
  // Carica categorie
  const catRes = await fetch(`${API_URL}/api/machine-categories`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (catRes.ok) {
    const cats = await catRes.json();
    document.getElementById('machine-category').innerHTML = 
      '<option value="">Seleziona...</option>' +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
  
  // Carica stabilimenti
  const plantRes = await fetch(`${API_URL}/api/plants`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (plantRes.ok) {
    const plants = await plantRes.json();
    document.getElementById('machine-plant').innerHTML = 
      '<option value="">Seleziona...</option>' +
      plants.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    // Aggiorna anche filtro
    document.getElementById('filter-plant').innerHTML = 
      '<option value="">Tutti gli stabilimenti</option>' +
      plants.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
  
  // Carica reparti
  const deptRes = await fetch(`${API_URL}/api/departments`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (deptRes.ok) {
    const depts = await deptRes.json();
    document.getElementById('machine-department').innerHTML = 
      '<option value="">Seleziona...</option>' +
      depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }
}

async function saveMachine(e) {
  e.preventDefault();
  
  const id = document.getElementById('machine-id').value;
  const data = {
    code: document.getElementById('machine-code').value,
    name: document.getElementById('machine-name').value,
    category_id: document.getElementById('machine-category').value || null,
    plant_id: document.getElementById('machine-plant').value || null,
    department_id: document.getElementById('machine-department').value || null,
    serial_number: document.getElementById('machine-serial').value,
    manufacturer: document.getElementById('machine-manufacturer').value,
    model: document.getElementById('machine-model').value,
    year: document.getElementById('machine-year').value || null,
    location: document.getElementById('machine-location').value,
    status: document.getElementById('machine-status').value,
    notes: document.getElementById('machine-notes').value
  };
  
  const url = id ? `${API_URL}/api/machines/${id}` : `${API_URL}/api/machines`;
  const method = id ? 'PUT' : 'POST';
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showToast(id ? 'Macchina aggiornata!' : 'Macchina creata!', 'success');
      closeModal('machine-modal');
      loadMachines();
    } else {
      const err = await response.json();
      showToast(err.error || 'Errore durante il salvataggio', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  }
}

async function deleteMachine(id) {
  if (!confirm('Sei sicuro di voler eliminare questa macchina?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/machines/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      showToast('Macchina eliminata!', 'success');
      loadMachines();
    }
  } catch (error) {
    showToast('Errore durante l\'eliminazione', 'error');
  }
}

function viewMachine(id) {
  fetch(`${API_URL}/api/machines/${id}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(m => {
    alert(`Macchina: ${m.name}\nCodice: ${m.code}\nStato: ${getStatusLabel(m.status)}\nS/N: ${m.serial_number || 'N/D'}\nProduttore: ${m.manufacturer || 'N/D'}\nPosizione: ${m.location || 'N/D'}`);
  });
}

function editMachine(id) {
  openMachineModal(id);
}

// ==================== MANUTENZIONI ====================

async function loadMaintenance() {
  try {
    const response = await fetch(`${API_URL}/api/maintenance`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const maintenance = await response.json();
    renderMaintenanceTable(maintenance);
  } catch (error) {
    console.error('Errore caricamento manutenzioni:', error);
  }
}

function renderMaintenanceTable(maintenance) {
  const tbody = document.querySelector('#maintenance-table tbody');
  
  if (maintenance.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nessuna manutenzione trovata</td></tr>';
    return;
  }
  
  tbody.innerHTML = maintenance.map(m => `
    <tr>
      <td>${formatDate(m.executed_date)}</td>
      <td><strong>${m.machine_code}</strong><br><small>${m.machine_name}</small></td>
      <td><span class="badge badge-${m.type}">${getTypeLabel(m.type)}</span></td>
      <td>${m.technician_name || '-'}</td>
      <td>${m.work_hours ? m.work_hours.toFixed(2) : '-'}</td>
      <td>${m.description.substring(0, 50)}...</td>
      <td>
        <button class="btn btn-icon" onclick="viewMaintenance(${m.id})"><i class="fas fa-eye"></i></button>
        ${currentUser.role === 'admin' ? `<button class="btn btn-icon" onclick="deleteMaintenance(${m.id})"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
}

function filterMaintenance() {
  const from = document.getElementById('filter-date-from').value;
  const to = document.getElementById('filter-date-to').value;
  const type = document.getElementById('filter-type').value;
  
  loadMaintenanceWithFilters({ from, to, type });
}

async function loadMaintenanceWithFilters(filters) {
  try {
    const params = new URLSearchParams();
    if (filters.from) params.append('start_date', filters.from);
    if (filters.to) params.append('end_date', filters.to);
    if (filters.type) params.append('type', filters.type);
    
    const response = await fetch(`${API_URL}/api/maintenance?${params}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const maintenance = await response.json();
      renderMaintenanceTable(maintenance);
    }
  } catch (error) {
    console.error('Errore filtro manutenzioni:', error);
  }
}

function openMaintenanceModal() {
  document.getElementById('maintenance-form').reset();
  document.getElementById('maintenance-id').value = '';
  document.getElementById('maintenance-date').valueAsDate = new Date();
  
  // Carica macchine
  fetch(`${API_URL}/api/machines`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(machines => {
    document.getElementById('maintenance-machine').innerHTML = 
      '<option value="">Seleziona macchina...</option>' +
      machines.map(m => `<option value="${m.id}">${m.code} - ${m.name}</option>`).join('');
  });
  
  // Carica tecnici
  fetch(`${API_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(users => {
    document.getElementById('maintenance-technician').innerHTML = 
      '<option value="">Seleziona tecnico...</option>' +
      users.map(u => `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${u.name}</option>`).join('');
  });
  
  document.getElementById('maintenance-modal').classList.add('active');
}

function calculateMaintenanceHours() {
  const start = document.getElementById('maintenance-start-time').value;
  const end = document.getElementById('maintenance-end-time').value;
  
  if (start && end) {
    const hours = calculateHoursBetween(start, end);
    document.getElementById('maintenance-hours').textContent = hours.toFixed(2);
  }
}

async function saveMaintenance(e) {
  e.preventDefault();
  
  const data = {
    machine_id: document.getElementById('maintenance-machine').value,
    type: document.getElementById('maintenance-type').value,
    executed_date: document.getElementById('maintenance-date').value,
    technician_id: document.getElementById('maintenance-technician').value,
    start_time: document.getElementById('maintenance-start-time').value,
    end_time: document.getElementById('maintenance-end-time').value,
    description: document.getElementById('maintenance-description').value,
    parts_used: document.getElementById('maintenance-parts').value,
    notes: document.getElementById('maintenance-notes').value
  };
  
  try {
    const response = await fetch(`${API_URL}/api/maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showToast('Manutenzione registrata!', 'success');
      closeModal('maintenance-modal');
      loadMaintenance();
      loadDashboardData();
    } else {
      const err = await response.json();
      showToast(err.error || 'Errore durante il salvataggio', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  }
}

async function viewMaintenance(id) {
  currentMaintenanceId = id;
  
  try {
    const response = await fetch(`${API_URL}/api/maintenance/${id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const m = await response.json();
    
    const content = document.getElementById('view-maintenance-content');
    content.innerHTML = `
      <div class="view-section">
        <h4>Macchina</h4>
        <p><strong>${m.machine_code}</strong> - ${m.machine_name}</p>
      </div>
      <div class="view-section">
        <h4>Data e Ora</h4>
        <p>${formatDate(m.executed_date)} | ${m.start_time || '-'} - ${m.end_time || '-'} (${m.work_hours ? m.work_hours.toFixed(2) : '0'} ore)</p>
      </div>
      <div class="view-section">
        <h4>Tipo</h4>
        <p><span class="badge badge-${m.type}">${getTypeLabel(m.type)}</span></p>
      </div>
      <div class="view-section">
        <h4>Tecnico</h4>
        <p>${m.technician_name || '-'}</p>
      </div>
      <div class="view-section">
        <h4>Descrizione Lavori</h4>
        <p>${m.description}</p>
      </div>
      ${m.parts_used ? `
      <div class="view-section">
        <h4>Ricambi Utilizzati</h4>
        <p>${m.parts_used}</p>
      </div>
      ` : ''}
      ${m.photos && m.photos.length > 0 ? `
      <div class="view-section">
        <h4>Foto</h4>
        <div class="view-photos">
          ${m.photos.map(p => `<img src="${p.thumbnail_path}" onclick="viewFullImage('${p.file_path}')">`).join('')}
        </div>
      </div>
      ` : ''}
    `;
    
    document.getElementById('view-maintenance-modal').classList.add('active');
  } catch (error) {
    showToast('Errore caricamento dettagli', 'error');
  }
}

async function deleteMaintenance(id) {
  if (!confirm('Sei sicuro di voler eliminare questa manutenzione?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/maintenance/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      showToast('Manutenzione eliminata!', 'success');
      loadMaintenance();
    }
  } catch (error) {
    showToast('Errore durante l\'eliminazione', 'error');
  }
}

async function exportMaintenance() {
  try {
    const response = await fetch(`${API_URL}/api/export/maintenance`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manutenzioni_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Esportazione completata!', 'success');
    }
  } catch (error) {
    showToast('Errore durante l\'esportazione', 'error');
  }
}

// ==================== INTERVENTO RAPIDO ====================

async function loadQuickEntryOptions() {
  // Carica macchine
  const machinesRes = await fetch(`${API_URL}/api/machines`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (machinesRes.ok) {
    const machines = await machinesRes.json();
    document.getElementById('quick-machine').innerHTML = 
      '<option value="">Seleziona macchina...</option>' +
      machines.map(m => `<option value="${m.id}">${m.code} - ${m.name}</option>`).join('');
  }
  
  // Carica tecnici
  const usersRes = await fetch(`${API_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (usersRes.ok) {
    const users = await usersRes.json();
    document.getElementById('quick-technician').innerHTML = 
      '<option value="">Seleziona tecnico...</option>' +
      users.map(u => `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${u.name}</option>`).join('');
  }
}

function calculateHours() {
  const start = document.getElementById('quick-start-time').value;
  const end = document.getElementById('quick-end-time').value;
  
  if (start && end) {
    const hours = calculateHoursBetween(start, end);
    document.getElementById('quick-hours').textContent = hours.toFixed(2);
  }
}

function calculateHoursBetween(start, end) {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  let hours = endH - startH;
  let minutes = endM - startM;
  
  if (minutes < 0) {
    hours--;
    minutes += 60;
  }
  
  if (hours < 0) {
    hours += 24; // Turno notturno
  }
  
  return hours + minutes / 60;
}

async function saveQuickMaintenance(e) {
  e.preventDefault();
  
  const data = {
    machine_id: document.getElementById('quick-machine').value,
    type: document.getElementById('quick-type').value,
    executed_date: document.getElementById('quick-date').value,
    technician_id: document.getElementById('quick-technician').value,
    start_time: document.getElementById('quick-start-time').value,
    end_time: document.getElementById('quick-end-time').value,
    description: document.getElementById('quick-description').value,
    parts_used: document.getElementById('quick-parts').value,
    notes: document.getElementById('quick-notes').value
  };
  
  try {
    const response = await fetch(`${API_URL}/api/maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Upload foto se presenti
      if (selectedPhotos.length > 0) {
        await uploadPhotos(result.id);
      }
      
      showToast('Intervento registrato!', 'success');
      playAlertSound('success');
      resetQuickForm();
      loadDashboardData();
    } else {
      const err = await response.json();
      showToast(err.error || 'Errore durante il salvataggio', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  }
}

function resetQuickForm() {
  document.getElementById('quick-maintenance-form').reset();
  document.getElementById('quick-date').valueAsDate = new Date();
  document.getElementById('quick-hours').textContent = '0.00';
  selectedPhotos = [];
  updatePhotoPreview();
}

// ==================== FOTO ====================

async function openCamera() {
  const video = document.getElementById('camera-video');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' },
      audio: false 
    });
    video.srcObject = stream;
    document.getElementById('camera-modal').classList.add('active');
  } catch (err) {
    showToast('Impossibile accedere alla fotocamera', 'error');
  }
}

function closeCamera() {
  const video = document.getElementById('camera-video');
  const stream = video.srcObject;
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  
  document.getElementById('camera-modal').classList.remove('active');
}

function takePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  canvas.toBlob(blob => {
    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
    selectedPhotos.push({ file, type: 'during' });
    updatePhotoPreview();
    closeCamera();
    showToast('Foto scattata!', 'success');
  }, 'image/jpeg', 0.85);
}

function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  
  files.forEach(file => {
    selectedPhotos.push({ file, type: 'during' });
  });
  
  updatePhotoPreview();
}

function updatePhotoPreview() {
  const container = document.getElementById('photo-preview');
  
  container.innerHTML = selectedPhotos.map((photo, index) => `
    <div class="photo-item">
      <img src="${URL.createObjectURL(photo.file)}" alt="Foto ${index + 1}">
      <button type="button" class="remove-photo" onclick="removePhoto(${index})">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function removePhoto(index) {
  selectedPhotos.splice(index, 1);
  updatePhotoPreview();
}

async function uploadPhotos(maintenanceId) {
  for (const photo of selectedPhotos) {
    const formData = new FormData();
    formData.append('photo', photo.file);
    formData.append('photo_type', photo.type);
    
    try {
      await fetch(`${API_URL}/api/maintenance/${maintenanceId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
    } catch (error) {
      console.error('Errore upload foto:', error);
    }
  }
  
  selectedPhotos = [];
}

// ==================== SCADENZE ====================

async function loadSchedules() {
  try {
    const response = await fetch(`${API_URL}/api/schedules`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const schedules = await response.json();
    renderSchedules(schedules);
  } catch (error) {
    console.error('Errore caricamento scadenze:', error);
  }
}

function renderSchedules(schedules) {
  const container = document.getElementById('schedules-list');
  
  if (schedules.length === 0) {
    container.innerHTML = '<p class="empty-state"><i class="fas fa-calendar-check"></i><br>Nessuna scadenza programmata</p>';
    return;
  }
  
  container.innerHTML = schedules.map(s => {
    const isOverdue = s.days_until < 0;
    const daysText = isOverdue ? `Scaduta da ${Math.abs(Math.floor(s.days_until))} gg` : `Tra ${Math.floor(s.days_until)} gg`;
    
    return `
      <div class="schedule-card ${isOverdue ? 'overdue' : 'upcoming'}">
        <div class="schedule-info">
          <h4>${s.machine_code} - ${s.machine_name}</h4>
          <p>${s.maintenance_type_name || 'Manutenzione'} | ${s.plant_name}</p>
        </div>
        <div class="schedule-date">
          <div class="date">${formatDate(s.next_execution)}</div>
          <div class="days">${daysText}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterSchedules(type) {
  // Aggiorna bottoni
  document.querySelectorAll('#page-schedules .btn-filter').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  
  // Ricarica con filtro
  const params = new URLSearchParams();
  if (type !== 'all') {
    params.append(type === 'overdue' ? 'overdue' : 'upcoming', 'true');
  }
  
  fetch(`${API_URL}/api/schedules?${params}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(schedules => renderSchedules(schedules));
}

// ==================== ALLARMI ====================

async function loadAlerts() {
  try {
    const response = await fetch(`${API_URL}/api/alerts`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const alerts = await response.json();
    renderAlerts(alerts);
  } catch (error) {
    console.error('Errore caricamento allarmi:', error);
  }
}

function renderAlerts(alerts) {
  const container = document.getElementById('alerts-list');
  
  if (alerts.length === 0) {
    container.innerHTML = '<p class="empty-state"><i class="fas fa-check-circle"></i><br>Nessun allarme</p>';
    return;
  }
  
  container.innerHTML = alerts.map(a => `
    <div class="alert-card ${a.priority}">
      <div class="alert-card-header">
        <div class="alert-card-title">
          <i class="fas ${a.alert_type === 'overdue' ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
          <h4>${a.machine_code} - ${a.machine_name}</h4>
        </div>
        <span class="priority-badge priority-${a.priority}">${getPriorityLabel(a.priority)}</span>
      </div>
      <p>Scadenza: ${formatDate(a.scheduled_date)}</p>
      <p>Stabilimento: ${a.plant_name}</p>
    </div>
  `).join('');
}

function filterAlerts(priority) {
  document.querySelectorAll('#page-alerts .btn-filter').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  
  const params = new URLSearchParams();
  if (priority !== 'all') params.append('priority', priority);
  
  fetch(`${API_URL}/api/alerts?${params}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(alerts => renderAlerts(alerts));
}

// ==================== UTENTI ====================

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) return;
    
    const users = await response.json();
    renderUsersTable(users);
  } catch (error) {
    console.error('Errore caricamento utenti:', error);
  }
}

function renderUsersTable(users) {
  const tbody = document.querySelector('#users-table tbody');
  
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge badge-${u.role}">${getRoleLabel(u.role)}</span></td>
      <td>${u.plant_name || '-'}</td>
      <td><span class="status-badge status-${u.is_active ? 'ok' : 'non-funzionante'}">${u.is_active ? 'Attivo' : 'Disattivato'}</span></td>
      <td>
        <button class="btn btn-icon" onclick="editUser(${u.id})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-icon" onclick="resetPassword(${u.id})"><i class="fas fa-key"></i></button>
      </td>
    </tr>
  `).join('');
}

function openUserModal() {
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-modal-title').textContent = 'Nuovo Utente';
  document.getElementById('password-group').style.display = 'block';
  document.getElementById('user-password').required = true;
  
  // Carica stabilimenti
  fetch(`${API_URL}/api/plants`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(plants => {
    document.getElementById('user-plant').innerHTML = 
      '<option value="">Nessuno</option>' +
      plants.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  });
  
  document.getElementById('user-modal').classList.add('active');
}

async function saveUser(e) {
  e.preventDefault();
  
  const id = document.getElementById('user-id').value;
  const data = {
    name: document.getElementById('user-name-input').value,
    email: document.getElementById('user-email').value,
    role: document.getElementById('user-role').value,
    plant_id: document.getElementById('user-plant').value || null,
    phone: document.getElementById('user-phone').value
  };
  
  if (!id) {
    data.password = document.getElementById('user-password').value;
  }
  
  const url = id ? `${API_URL}/api/users/${id}` : `${API_URL}/api/users`;
  const method = id ? 'PUT' : 'POST';
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showToast(id ? 'Utente aggiornato!' : 'Utente creato!', 'success');
      closeModal('user-modal');
      loadUsers();
    } else {
      const err = await response.json();
      showToast(err.error || 'Errore durante il salvataggio', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  }
}

function editUser(id) {
  fetch(`${API_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  })
  .then(r => r.json())
  .then(users => {
    const u = users.find(user => user.id === id);
    if (!u) return;
    
    document.getElementById('user-id').value = u.id;
    document.getElementById('user-name-input').value = u.name;
    document.getElementById('user-email').value = u.email;
    document.getElementById('user-role').value = u.role;
    document.getElementById('user-plant').value = u.plant_id || '';
    document.getElementById('user-phone').value = u.phone || '';
    document.getElementById('user-modal-title').textContent = 'Modifica Utente';
    document.getElementById('password-group').style.display = 'none';
    document.getElementById('user-password').required = false;
    
    document.getElementById('user-modal').classList.add('active');
  });
}

async function resetPassword(id) {
  const password = prompt('Inserisci la nuova password:');
  if (!password) return;
  
  try {
    const response = await fetch(`${API_URL}/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ password })
    });
    
    if (response.ok) {
      showToast('Password aggiornata!', 'success');
    }
  } catch (error) {
    showToast('Errore durante l\'aggiornamento', 'error');
  }
}

// ==================== IMPOSTAZIONI ====================

async function loadSettings() {
  try {
    const response = await fetch(`${API_URL}/api/email-settings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const settings = await response.json();
      document.getElementById('smtp-host').value = settings.smtp_host || '';
      document.getElementById('smtp-port').value = settings.smtp_port || '587';
      document.getElementById('smtp-user').value = settings.smtp_user || '';
      document.getElementById('smtp-from').value = settings.smtp_from || '';
    }
  } catch (error) {
    console.error('Errore caricamento impostazioni:', error);
  }
}

async function saveEmailSettings(e) {
  e.preventDefault();
  
  const data = {
    smtp_host: document.getElementById('smtp-host').value,
    smtp_port: document.getElementById('smtp-port').value,
    smtp_user: document.getElementById('smtp-user').value,
    smtp_pass: document.getElementById('smtp-pass').value,
    smtp_from: document.getElementById('smtp-from').value
  };
  
  try {
    const response = await fetch(`${API_URL}/api/email-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      showToast('Impostazioni salvate!', 'success');
    }
  } catch (error) {
    showToast('Errore durante il salvataggio', 'error');
  }
}

// ==================== EMAIL REPORT ====================

async function sendReportByEmail() {
  if (!currentMaintenanceId) return;
  
  const to = prompt('Inserisci l\'email del destinatario:', currentUser.email);
  if (!to) return;
  
  try {
    const response = await fetch(`${API_URL}/api/send-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        to,
        maintenance_id: currentMaintenanceId
      })
    });
    
    if (response.ok) {
      showToast('Report inviato!', 'success');
    } else {
      showToast('Errore durante l\'invio', 'error');
    }
  } catch (error) {
    showToast('Errore di connessione', 'error');
  }
}

// ==================== UTILITÀ ====================

function loadSelectOptions() {
  // Opzioni già caricate nelle funzioni specifiche
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT');
}

function getStatusLabel(status) {
  const labels = {
    'OK': 'Funzionante',
    'DA_TESTARE': 'Da Testare',
    'NON_FUNZIONANTE': 'Non Funzionante'
  };
  return labels[status] || status;
}

function getTypeLabel(type) {
  const labels = {
    'ordinary': 'Ordinaria',
    'scheduled': 'Programmata',
    'emergency': 'Emergenza'
  };
  return labels[type] || type;
}

function getPriorityLabel(priority) {
  const labels = {
    'urgent': 'Urgente',
    'high': 'Alta',
    'medium': 'Media',
    'low': 'Bassa'
  };
  return labels[priority] || priority;
}

function getRoleLabel(role) {
  const labels = {
    'admin': 'Amministratore',
    'manager': 'Manager',
    'technician': 'Tecnico'
  };
  return labels[role] || role;
}

function viewFullImage(src) {
  window.open(src, '_blank');
}

// ==================== INPUT VOCALE ====================

function startVoiceInput(targetId) {
  if (!('webkitSpeechRecognition' in window)) {
    showToast('Input vocale non supportato', 'error');
    return;
  }
  
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'it-IT';
  recognition.continuous = false;
  recognition.interimResults = false;
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const target = document.getElementById(targetId);
    target.value += (target.value ? ' ' : '') + transcript;
  };
  
  recognition.onerror = () => {
    showToast('Errore riconoscimento vocale', 'error');
  };
  
  recognition.start();
  showToast('Parla ora...', 'info');
}
