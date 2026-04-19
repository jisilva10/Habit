// ══════════════════════════════════════════════════════
//  Habits App — Supabase Backend
//  Configura tus credenciales de Supabase aquí:
// ══════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://TU_PROYECTO.supabase.co';   // ← cambia esto
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';                       // ← cambia esto

// ── Preset emoji palette ──
const EMOJIS = ['🐐','💪','💧','📚','🏃','🧘','🥗','😴','🎯','🧠','🚴','✍️'];

// ── App state ──
let habits     = [];   // [{ id, name, emoji, created_at }]
let allData    = [];   // [{ id, habit_id, fecha, value }]  — logs table
let currentKey = null; // habit UUID
let selDate    = todayStr();
let selEmoji   = EMOJIS[0];
let wChart     = null;

// ══════════════════════════════════════════════════════
//  SUPABASE REST API HELPER
// ══════════════════════════════════════════════════════
async function sb(path, options = {}) {
  const { method = 'GET', body, prefer } = options;
  const headers = {
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        prefer || 'return=representation',
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  // DELETE returns 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function parseDate(s) {
  return new Date(s + 'T00:00:00');
}
function wkNum(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días ☀️';
  if (h < 19) return 'Buenas tardes 🌤';
  return 'Buenas noches 🌙';
}

// ══════════════════════════════════════════════════════
//  FALLBACK DATA (demo when Supabase not configured)
// ══════════════════════════════════════════════════════
function loadFallback() {
  const id1 = 'demo-goat';
  const id2 = 'demo-pushups';
  habits = [
    { id: id1, name: '🐐 Goat Mode', emoji: '🐐' },
    { id: id2, name: '20 Push Ups',  emoji: '💪' },
  ];
  const today = todayStr();
  allData = [
    { habit_id: id1, fecha: '2026-04-13', value: 1 },
    { habit_id: id2, fecha: '2026-04-13', value: 1 },
    { habit_id: id1, fecha: '2026-04-14', value: 1 },
    { habit_id: id2, fecha: '2026-04-14', value: 0 },
    { habit_id: id1, fecha: '2026-04-15', value: 1 },
    { habit_id: id2, fecha: '2026-04-15', value: 1 },
    { habit_id: id1, fecha: '2026-04-16', value: 0 },
    { habit_id: id2, fecha: '2026-04-16', value: 1 },
    { habit_id: id1, fecha: '2026-04-17', value: 1 },
    { habit_id: id2, fecha: '2026-04-17', value: 1 },
    { habit_id: id1, fecha: '2026-04-18', value: 1 },
    { habit_id: id2, fecha: '2026-04-18', value: 1 },
    { habit_id: id1, fecha: today,        value: 1 },
    { habit_id: id2, fecha: today,        value: 0 },
  ];
}

// ══════════════════════════════════════════════════════
//  SYNC — load habits + logs from Supabase
// ══════════════════════════════════════════════════════
async function syncData() {
  try {
    const [habitsRes, logsRes] = await Promise.all([
      sb('habits?select=*&order=created_at'),
      sb('logs?select=*&order=fecha'),
    ]);
    habits  = habitsRes;
    allData = logsRes;
  } catch (e) {
    console.warn('Supabase no disponible, usando demo:', e.message);
    loadFallback();
    showToast('Modo demo — configura Supabase');
  }
  renderHome();
}

// ══════════════════════════════════════════════════════
//  STATS — computed from logs for a given habit UUID
// ══════════════════════════════════════════════════════
function stats(habitId) {
  const logs   = allData.filter(l => l.habit_id === habitId);
  const sorted = [...logs].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total  = sorted.length;
  const done   = sorted.filter(l => l.value === 1).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  // Current streak from today backwards
  const byDate = {};
  sorted.forEach(l => byDate[l.fecha] = l.value);
  let cur = 0;
  let d   = new Date(todayStr());
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (byDate[ds] === 1) { cur++; d.setDate(d.getDate() - 1); }
    else break;
  }

  // Best streak
  let best = 0, c = 0;
  sorted.forEach(l => {
    if (l.value === 1) { c++; if (c > best) best = c; }
    else c = 0;
  });

  return { pct, cur, best };
}

function getLogValue(habitId, fecha) {
  const log = allData.find(l => l.habit_id === habitId && l.fecha === fecha);
  return log ? log.value : undefined;
}

// ══════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════
function renderHome() {
  document.getElementById('greet').textContent = greeting();

  const today    = todayStr();
  const td       = parseDate(today);
  document.getElementById('todayLabel').textContent =
    td.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });

  const doneCount = habits.filter(h => getLogValue(h.id, today) === 1).length;
  document.getElementById('todayScore').textContent = `${doneCount}/${habits.length}`;

  const list = document.getElementById('habitsList');
  list.innerHTML = '';

  if (!habits.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <div class="empty-title">Sin hábitos aún</div>
        <div class="empty-sub">Toca el botón <strong>+</strong> para crear tu primer hábito.</div>
      </div>`;
    return;
  }

  habits.forEach(h => {
    const s          = stats(h.id);
    const tv         = getLogValue(h.id, today);
    const statusClass= tv === 1 ? 'status-done' : tv === 0 ? 'status-miss' : '';

    const card = document.createElement('div');
    card.className = `habit-card ${statusClass}`;
    card.innerHTML = `
      <div class="card-status-bar"></div>
      <div class="card-top">
        <div class="card-emoji">${h.emoji}</div>
        <div class="card-dot"></div>
      </div>
      <div class="card-name">${h.name}</div>
      <div class="card-progress">
        <div class="card-progress-fill" style="width:${s.pct}%"></div>
      </div>
      <div class="card-footer">
        <div class="card-pct ${s.pct >= 70 ? 'high' : 'low'}">${s.pct}%</div>
        <div class="card-streak">
          <div class="card-streak-num">${s.cur} 🔥</div>
          <div class="card-streak-lbl">Racha</div>
        </div>
      </div>`;
    card.addEventListener('click', () => openDetail(h.id));
    list.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════
//  DETAIL
// ══════════════════════════════════════════════════════
function openDetail(habitId) {
  currentKey = habitId;
  selDate    = todayStr();

  const h = habits.find(x => x.id === habitId);
  document.getElementById('detailEmoji').textContent = h.emoji;
  document.getElementById('detailTitle').textContent = h.name;
  document.getElementById('home').classList.remove('active');
  document.getElementById('detail').classList.add('active');
  renderDetail();
}

function goHome() {
  document.getElementById('detail').classList.remove('active');
  document.getElementById('home').classList.add('active');
  renderHome();
}

function renderDetail() {
  const s = stats(currentKey);
  document.getElementById('dPct').textContent     = s.pct + '%';
  document.getElementById('dCurrent').textContent = s.cur;
  document.getElementById('dBest').textContent    = s.best;
  renderDateNav();
  renderActionBtn();
  renderCal();
  renderChart();
}

function renderDateNav() {
  document.getElementById('dateNavLabel').textContent =
    parseDate(selDate).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'long' });
  document.getElementById('nextDay').disabled = selDate >= todayStr();
}

function shiftDay(d) {
  const nd = new Date(selDate + 'T00:00:00');
  nd.setDate(nd.getDate() + d);
  const ns = nd.toISOString().slice(0, 10);
  if (ns > todayStr()) return;
  selDate = ns;
  renderDateNav();
  renderActionBtn();
  renderCal();
}

function renderActionBtn() {
  const done = getLogValue(currentKey, selDate) === 1;
  const btn  = document.getElementById('btnDone');
  const lbl  = document.getElementById('btnDoneLabel');
  btn.classList.toggle('active-state', done);
  lbl.textContent = done ? 'Completado' : 'Marcar hecho';
}

// ══════════════════════════════════════════════════════
//  MARK DAY — upsert log in Supabase
//  Uses ON CONFLICT (habit_id, fecha) DO UPDATE
// ══════════════════════════════════════════════════════
async function markDay(val) {
  // Optimistic update
  const existing = allData.find(l => l.habit_id === currentKey && l.fecha === selDate);
  if (existing) {
    existing.value = val;
  } else {
    allData.push({ habit_id: currentKey, fecha: selDate, value: val });
  }
  renderDetail();
  renderHome();
  showToast(val === 1 ? '¡Hábito marcado! ✓' : 'Desmarcado');

  // Persist to Supabase
  try {
    await sb('logs', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body:   { habit_id: currentKey, fecha: selDate, value: val },
    });
  } catch (e) {
    showToast('Error guardando, recarga la app');
    console.error(e);
  }
}

// ══════════════════════════════════════════════════════
//  CALENDAR
// ══════════════════════════════════════════════════════
function renderCal() {
  const today = todayStr();
  const sel   = parseDate(selDate);
  const y     = sel.getFullYear();
  const m     = sel.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const sdow  = (first.getDay() + 6) % 7;

  const ne = document.getElementById('calDayNames');
  const ce = document.getElementById('calCells');
  ne.innerHTML = ['L','M','X','J','V','S','D']
    .map(n => `<div class="cal-day-name">${n}</div>`).join('');
  ce.innerHTML = '';

  for (let i = 0; i < sdow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell empty';
    ce.appendChild(e);
  }

  for (let day = 1; day <= last.getDate(); day++) {
    const ds      = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isFut   = ds > today;
    const isToday = ds === today;
    const val     = getLogValue(currentKey, ds);

    let cls = 'cal-cell';
    if (isFut)                  cls += ' future';
    else if (val === 1)         cls += ' done-day';
    else if (val !== undefined) cls += ' miss-day';
    if (isToday)                cls += ' today-cell';

    const c = document.createElement('div');
    c.className = cls;
    c.innerHTML = `<div class="day-num">${day}</div>${!isFut ? '<div class="day-dot"></div>' : ''}`;
    if (!isFut) {
      c.addEventListener('click', () => {
        selDate = ds;
        renderDateNav();
        renderActionBtn();
        renderCal();
        document.querySelector('.action-area').scrollIntoView({ behavior: 'smooth' });
      });
    }
    ce.appendChild(c);
  }
}

// ══════════════════════════════════════════════════════
//  CHART
// ══════════════════════════════════════════════════════
function renderChart() {
  const logs   = allData.filter(l => l.habit_id === currentKey);
  const wm     = {};
  logs.forEach(l => {
    const d = parseDate(l.fecha);
    const w = 'Sem ' + wkNum(d);
    if (!wm[w]) wm[w] = { done: 0, total: 0 };
    wm[w].total++;
    if (l.value === 1) wm[w].done++;
  });

  const labels = Object.keys(wm).sort((a, b) =>
    parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1])
  );
  const data = labels.map(l => {
    const w = wm[l];
    return Math.round((w.done / w.total) * 100);
  });

  const ctx = document.getElementById('weekChart').getContext('2d');
  if (wChart) wChart.destroy();

  wChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v => v >= 70 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)'),
        borderColor:     data.map(v => v >= 70 ? '#22c55e'               : '#ef4444'),
        borderWidth:     1.5,
        borderRadius:    8,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks:       { label: c => `${c.parsed.y}% completado` },
          backgroundColor: '#141412',
          titleColor:      '#f5f4f0',
          bodyColor:       '#a8a89a',
          padding:         10,
          cornerRadius:    10,
        },
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: { callback: v => v + '%', font: { size: 11, family: 'Inter' }, color: '#a8a89a', stepSize: 25 },
          grid:  { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          ticks: { font: { size: 11, family: 'Inter' }, color: '#a8a89a' },
          grid:  { display: false },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════
//  ADD HABIT MODAL
// ══════════════════════════════════════════════════════
function openAddModal() {
  document.getElementById('habitName').value   = '';
  document.getElementById('customEmoji').value = '';
  selEmoji = EMOJIS[0];

  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.className   = 'em-opt' + (em === selEmoji ? ' sel' : '');
    b.textContent = em;
    b.onclick = () => {
      selEmoji = em;
      document.getElementById('customEmoji').value = '';
      grid.querySelectorAll('.em-opt').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    };
    grid.appendChild(b);
  });

  document.getElementById('customEmoji').oninput = function () {
    if (this.value.trim()) {
      selEmoji = this.value.trim();
      grid.querySelectorAll('.em-opt').forEach(x => x.classList.remove('sel'));
    }
  };

  document.getElementById('addModal').classList.add('open');
  setTimeout(() => document.getElementById('habitName').focus(), 350);
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

async function submitNewHabit() {
  const name  = document.getElementById('habitName').value.trim();
  const emoji = document.getElementById('customEmoji').value.trim() || selEmoji;
  if (!name) { showToast('Escribe un nombre'); return; }

  const btn = document.getElementById('submitHabit');
  btn.disabled    = true;
  btn.textContent = 'Creando…';

  try {
    const result = await sb('habits', {
      method: 'POST',
      body:   { name, emoji },
    });
    habits.push(result[0]);
    closeAddModal();
    renderHome();
    showToast(`"${name}" creado ✓`);
  } catch (e) {
    showToast('Error al crear hábito');
    console.error(e);
  }

  btn.disabled    = false;
  btn.textContent = 'Crear hábito →';
}

// ══════════════════════════════════════════════════════
//  SHARED UTILS
// ══════════════════════════════════════════════════════
function bgClick(e, id, fn) {
  if (e.target === document.getElementById(id)) fn();
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
syncData();
