// ══════════════════════════════════════════════════════
//  Habits App — Production config
// ══════════════════════════════════════════════════════

const N8N_GET    = 'https://1.jisn8n.work/webhook/habits';      // GET  — fetch all data
const N8N_POST   = 'https://1.jisn8n.work/webhook/habits';      // POST — mark/unmark a day
const N8N_CREATE = 'https://1.jisn8n.work/webhook/habits-new';  // POST — create new habit

// ── Preset emojis ──
const EMOJIS = ['🐐','💪','💧','📚','🏃','🧘','🥗','😴','🎯','🧠','🚴','✍️'];

// ── App state ──
let allData    = [];
let habits     = [];
let currentKey = null;
let selDate    = todayStr();
let selEmoji   = EMOJIS[0];
let wChart     = null;

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
//  FALLBACK DATA (offline / demo)
// ══════════════════════════════════════════════════════
function loadFallback() {
  habits = [
    { key: 'goat',    name: '🐐 Goat Mode', emoji: '🐐' },
    { key: 'pushups', name: '20 Push Ups',  emoji: '💪' },
  ];
  const today = todayStr();
  allData = [
    { fecha: '2026-04-13', week: 16, goat: 1, pushups: 1 },
    { fecha: '2026-04-14', week: 16, goat: 1, pushups: 0 },
    { fecha: '2026-04-15', week: 16, goat: 1, pushups: 1 },
    { fecha: '2026-04-16', week: 16, goat: 0, pushups: 1 },
    { fecha: '2026-04-17', week: 16, goat: 1, pushups: 1 },
    { fecha: '2026-04-18', week: 16, goat: 1, pushups: 1 },
    { fecha: today,        week: 17, goat: 1, pushups: 0 },
  ];
}

// ══════════════════════════════════════════════════════
//  DATA SYNC
// ══════════════════════════════════════════════════════
async function syncData() {
  try {
    const res = await fetch(N8N_GET);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

    if (json.habits && json.rows) {
      habits  = json.habits;
      allData = json.rows;
    } else {
      // Normalise flat row format
      const rows = Array.isArray(json) ? json : [json];
      allData = rows.map(r => ({
        fecha:   r['Fecha']   || r['fecha'],
        week:    parseInt(r['Week'] || r['week'] || 0),
        goat:    parseInt(r['🐐']  ?? r['goat']    ?? 0),
        pushups: parseInt(r['20 push ups'] ?? r['pushups'] ?? 0),
      })).filter(r => r.fecha);
      if (!habits.length) loadFallback();
    }
  } catch (e) {
    loadFallback();
  }
  renderHome();
}

// ══════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════
function stats(key) {
  const sorted = [...allData].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total  = sorted.length;
  const done   = sorted.filter(r => r[key] === 1).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  // Current streak (backwards from today)
  const byDate = {};
  sorted.forEach(r => byDate[r.fecha] = r[key]);
  let cur = 0;
  let d   = new Date(todayStr());
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (byDate[ds] === 1) { cur++; d.setDate(d.getDate() - 1); }
    else break;
  }

  // Best streak
  let best = 0, c = 0;
  sorted.forEach(r => {
    if (r[key] === 1) { c++; if (c > best) best = c; }
    else c = 0;
  });

  return { pct, cur, best };
}

function getRow(f) {
  return allData.find(r => r.fecha === f);
}

// ══════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════
function renderHome() {
  document.getElementById('greet').textContent = greeting();

  const today    = todayStr();
  const td       = parseDate(today);
  const todayRow = getRow(today);

  document.getElementById('todayLabel').textContent =
    td.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });

  const doneCount = habits.filter(h => todayRow && todayRow[h.key] === 1).length;
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
    const s  = stats(h.key);
    const tv = todayRow ? todayRow[h.key] : undefined;
    const statusClass = tv === 1 ? 'status-done' : tv === 0 ? 'status-miss' : '';

    const card = document.createElement('div');
    card.className = `habit-card ${statusClass}`;
    card.innerHTML = `
      <div class="card-status-bar"></div>
      <div class="card-top">
        <div class="card-emoji">${h.emoji || '📌'}</div>
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
    card.addEventListener('click', () => openDetail(h.key));
    list.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════
//  DETAIL
// ══════════════════════════════════════════════════════
function openDetail(key) {
  currentKey = key;
  selDate    = todayStr();

  const h = habits.find(x => x.key === key);
  document.getElementById('detailEmoji').textContent  = h.emoji || '📌';
  document.getElementById('detailTitle').textContent  = h.name;
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
  const row  = getRow(selDate);
  const done = row && row[currentKey] === 1;
  const btn  = document.getElementById('btnDone');
  const lbl  = document.getElementById('btnDoneLabel');
  btn.classList.toggle('active-state', done);
  lbl.textContent = done ? 'Completado' : 'Marcar hecho';
}

function markDay(val) {
  let row = getRow(selDate);
  if (row) {
    row[currentKey] = val;
  } else {
    const d  = parseDate(selDate);
    const nr = { fecha: selDate, week: wkNum(d) };
    habits.forEach(h => nr[h.key] = 0);
    nr[currentKey] = val;
    allData.push(nr);
  }
  pushMark(selDate, currentKey, val);
  renderDetail();
  renderHome();
  showToast(val === 1 ? '¡Hábito marcado! ✓' : 'Desmarcado');
}

async function pushMark(fecha, key, val) {
  try {
    await fetch(N8N_POST, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fecha, habit: key, value: val }),
    });
  } catch (e) {
    // silent — local state already updated
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
  const sdow  = (first.getDay() + 6) % 7;   // Monday-first offset

  const ne = document.getElementById('calDayNames');
  const ce = document.getElementById('calCells');

  ne.innerHTML = ['L','M','X','J','V','S','D']
    .map(n => `<div class="cal-day-name">${n}</div>`).join('');
  ce.innerHTML = '';

  // Empty leading cells
  for (let i = 0; i < sdow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell empty';
    ce.appendChild(e);
  }

  const bd = {};
  allData.forEach(r => bd[r.fecha] = r[currentKey]);

  for (let day = 1; day <= last.getDate(); day++) {
    const ds     = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isFut  = ds > today;
    const isToday= ds === today;
    const val    = bd[ds];

    let cls = 'cal-cell';
    if (isFut)              cls += ' future';
    else if (val === 1)     cls += ' done-day';
    else if (val !== undefined) cls += ' miss-day';
    if (isToday)            cls += ' today-cell';
    if (ds === selDate)     cls += ' selected-day';

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
  const wm = {};
  allData.forEach(r => {
    const w = 'Sem ' + r.week;
    if (!wm[w]) wm[w] = { done: 0, total: 0 };
    wm[w].total++;
    if (r[currentKey] === 1) wm[w].done++;
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
        backgroundColor: data.map(v => v >= 70 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)'),
        borderColor:     data.map(v => v >= 70 ? '#4ade80'               : '#f87171'),
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
        tooltip: { callbacks: { label: c => `${c.parsed.y}% completado` } },
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: {
            callback: v => v + '%',
            font: { size: 11, family: 'Inter' },
            color: '#5a5a70',
            stepSize: 25,
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        x: {
          ticks: { font: { size: 11, family: 'Inter' }, color: '#5a5a70' },
          grid: { display: false },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════
//  ADD HABIT MODAL
// ══════════════════════════════════════════════════════
function openAddModal() {
  document.getElementById('habitName').value  = '';
  document.getElementById('customEmoji').value = '';
  selEmoji = EMOJIS[0];

  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.className = 'em-opt' + (em === selEmoji ? ' sel' : '');
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

  const key = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);

  habits.push({ key, name, emoji });
  allData.forEach(r => { if (r[key] === undefined) r[key] = 0; });

  closeAddModal();
  renderHome();
  showToast(`"${name}" creado ✓`);

  try {
    await fetch(N8N_CREATE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, emoji, key }),
    });
  } catch (e) {
    showToast('Guardado local. Sincronizará al recargar.');
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
