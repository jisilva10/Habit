// ══════════════════════════════════════════════════════
//  Habits App — Production
// ══════════════════════════════════════════════════════

const N8N_GET    = 'https://1.jisn8n.work/webhook/habits';      // GET  — fetch all rows
const N8N_POST   = 'https://1.jisn8n.work/webhook/habits';      // POST — mark/unmark a day
const N8N_CREATE = 'https://1.jisn8n.work/webhook/habits-new';  // POST — create new habit

// Sheet columns that are NOT habits
const SKIP_COLS = new Set(['fecha', 'Fecha', 'FECHA', 'week', 'Week', 'WEEK']);

// Preset emoji palette for new habits
const EMOJIS = ['🐐','💪','💧','📚','🏃','🧘','🥗','😴','🎯','🧠','🚴','✍️'];

// ── App state ──
let allData    = [];   // array of row objects: { fecha, week, [habitKey]: 0|1, ... }
let habits     = [];   // array of { key, name, emoji }
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

// Extract the first emoji character from a string, if any
function extractEmoji(str) {
  const m = str.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u);
  return m ? m[0] : null;
}

// ══════════════════════════════════════════════════════
//  DATA PARSING
//  Reads the sheet response and auto-discovers habits
//  from any column that isn't Fecha/Week.
//
//  Sheet format expected from n8n:
//  [ { "Fecha": "2026-04-13", "Week": 16, "🐐": 1, "20 push ups": 0 }, ... ]
// ══════════════════════════════════════════════════════
function parseSheetResponse(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;

  const firstRow = rows[0];

  // Discover habit columns = all keys that are not fecha/week
  const habitCols = Object.keys(firstRow).filter(k => !SKIP_COLS.has(k));
  if (!habitCols.length) return false;

  // Build habits array from column headers
  habits = habitCols.map(col => {
    const emoji = extractEmoji(col);
    // If the col IS just an emoji, use it as the display name too
    const name  = col.trim();
    return { key: col, name, emoji: emoji || '📌' };
  });

  // Normalise rows — keep original column keys as habit keys
  allData = rows.map(r => {
    const row = {
      fecha: r['Fecha'] || r['fecha'] || r['FECHA'] || '',
      week:  parseInt(r['Week'] || r['week'] || r['WEEK'] || 0),
    };
    habitCols.forEach(col => {
      // Value can come as number or string "1"/"0"
      row[col] = parseInt(r[col] ?? 0);
    });
    return row;
  }).filter(r => r.fecha);

  return true;
}

// ══════════════════════════════════════════════════════
//  FALLBACK DATA (offline / demo)
//  Column keys = exact sheet column names
// ══════════════════════════════════════════════════════
function loadFallback() {
  habits = [
    { key: '🐐',          name: '🐐',          emoji: '🐐' },
    { key: '20 push ups', name: '20 push ups',  emoji: '💪' },
  ];
  const today = todayStr();
  allData = [
    { fecha: '2026-04-13', week: 16, '🐐': 1, '20 push ups': 1 },
    { fecha: '2026-04-14', week: 16, '🐐': 1, '20 push ups': 0 },
    { fecha: '2026-04-15', week: 16, '🐐': 1, '20 push ups': 1 },
    { fecha: '2026-04-16', week: 16, '🐐': 0, '20 push ups': 1 },
    { fecha: '2026-04-17', week: 16, '🐐': 1, '20 push ups': 1 },
    { fecha: '2026-04-18', week: 16, '🐐': 1, '20 push ups': 1 },
    { fecha: today,        week: 17, '🐐': 1, '20 push ups': 0 },
  ];
}

// ══════════════════════════════════════════════════════
//  SYNC — GET from n8n
//
//  n8n returns: { habits: [{key, name, emoji}], rows: [{fecha, week, "🐐": 0|1, ...}] }
//  Fallback:    flat array of sheet rows (for direct Google Sheets calls)
// ══════════════════════════════════════════════════════
async function syncData() {
  try {
    const res = await fetch(N8N_GET);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

    if (json.habits && json.rows) {
      // ✅ Normal path: n8n processed response
      // habits[i].key = exact sheet column name (e.g. "🐐" or "20 push ups")
      // rows[i]  = { fecha, week, "🐐": 1, "20 push ups": 0, ... }
      habits  = json.habits;
      allData = json.rows;
    } else {
      // Fallback: flat row array — detect habits from columns
      const rows = Array.isArray(json) ? json : [json];
      const ok   = parseSheetResponse(rows);
      if (!ok) throw new Error('No habit columns found in response');
    }

  } catch (e) {
    console.warn('syncData — usando datos locales:', e.message);
    loadFallback();
  }
  renderHome();
}

// ══════════════════════════════════════════════════════
//  STATS — computed per habit key
// ══════════════════════════════════════════════════════
function stats(key) {
  const sorted = [...allData].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total  = sorted.length;
  const done   = sorted.filter(r => r[key] === 1).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  // Current streak backwards from today
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
    const s          = stats(h.key);
    const tv         = todayRow ? todayRow[h.key] : undefined;
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
  const sdow  = (first.getDay() + 6) % 7; // Monday-first

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

  const bd = {};
  allData.forEach(r => bd[r.fecha] = r[currentKey]);

  for (let day = 1; day <= last.getDate(); day++) {
    const ds      = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isFut   = ds > today;
    const isToday = ds === today;
    const val     = bd[ds];

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
        backgroundColor: data.map(v =>
          v >= 70 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)'
        ),
        borderColor: data.map(v =>
          v >= 70 ? '#22c55e' : '#ef4444'
        ),
        borderWidth:   1.5,
        borderRadius:  8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: c => `${c.parsed.y}% completado` },
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
          ticks: {
            callback: v => v + '%',
            font:     { size: 11, family: 'Inter' },
            color:    '#a8a89a',
            stepSize: 25,
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
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

  // The key equals the display name (matching how the sheet column will be named)
  const key = name;
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
