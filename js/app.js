// ══════════════════════════════════════════════════════
//  Habits App — Supabase Backend
//  ⚙️  Configura tus credenciales aquí:
// ══════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://TU_PROYECTO.supabase.co';   // ← tu URL
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';                       // ← tu anon key

// Preset emojis
const EMOJIS = ['🐐','💪','💧','📚','🏃','🧘','🥗','😴','🎯','🧠','🚴','✍️'];

// ── State ──
let habits     = [];
let allData    = [];   // logs: [{id, habit_id, fecha, value}]
let currentKey = null; // active habit UUID
let editHabitId= null; // habit UUID being edited
let selDate    = todayStr();
let selEmoji   = EMOJIS[0];
let editEmoji  = EMOJIS[0];
let wChart     = null;

// ══════════════════════════════════════════════════════
//  SUPABASE REST HELPER
// ══════════════════════════════════════════════════════
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        prefer || 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Supabase ${res.status}: ${msg}`);
  }
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
  return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ══════════════════════════════════════════════════════
//  FALLBACK (demo mode)
// ══════════════════════════════════════════════════════
function loadFallback() {
  const id1 = 'demo-goat', id2 = 'demo-push';
  habits = [
    { id: id1, name: 'Goat Mode', emoji: '🐐' },
    { id: id2, name: '20 Push Ups', emoji: '💪' },
  ];
  const today = todayStr();
  allData = [
    ...[['2026-04-13',1,1],['2026-04-14',1,0],['2026-04-15',1,1],
        ['2026-04-16',0,1],['2026-04-17',1,1],['2026-04-18',1,1],
        [today,1,0]
    ].flatMap(([d,g,p]) => [
      { habit_id: id1, fecha: d, value: g },
      { habit_id: id2, fecha: d, value: p },
    ]),
  ];
}

// ══════════════════════════════════════════════════════
//  SYNC
// ══════════════════════════════════════════════════════
async function syncData() {
  try {
    const [h, l] = await Promise.all([
      sb('habits?select=*&order=created_at'),
      sb('logs?select=*&order=fecha'),
    ]);
    habits  = h;
    allData = l;
  } catch (e) {
    console.warn('Supabase no disponible, modo demo:', e.message);
    loadFallback();
    showToast('Modo demo — configura Supabase');
  }
  renderHome();
}

// PWA refresh
function refreshApp() {
  const btn = document.getElementById('refreshBtn');
  btn.style.animation = 'spin .6s linear 2';
  setTimeout(() => { btn.style.animation = ''; window.location.reload(); }, 1200);
}

// ══════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════
function stats(habitId) {
  const logs   = allData.filter(l => l.habit_id === habitId);
  const sorted = [...logs].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total  = sorted.length;
  const done   = sorted.filter(l => l.value === 1).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  // Current streak backwards from today
  const byDate = {};
  sorted.forEach(l => { byDate[l.fecha] = l.value; });
  let cur = 0;
  const d = new Date(todayStr());
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

  const today = todayStr();
  document.getElementById('todayLabel').textContent =
    parseDate(today).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });

  const done = habits.filter(h => getLogValue(h.id, today) === 1).length;
  document.getElementById('todayScore').textContent = `${done}/${habits.length}`;

  const list = document.getElementById('habitsList');
  list.innerHTML = '';

  if (!habits.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <div class="empty-title">Sin hábitos</div>
        <div class="empty-sub">Toca <strong>+</strong> para crear tu primer hábito.</div>
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
      <div class="card-strip"></div>
      <div class="card-top">
        <div class="card-emoji-wrap">${h.emoji}</div>
        <div class="card-status-dot"></div>
      </div>
      <div class="card-name">${h.name}</div>
      <div class="card-bar-track">
        <div class="card-bar-fill" style="width:${s.pct}%"></div>
      </div>
      <div class="card-footer">
        <span class="card-pct ${s.pct >= 70 ? 'high' : 'low'}">${s.pct}%</span>
        <div class="card-streak">
          <span class="card-streak-num">${s.cur}🔥</span>
          <span class="card-streak-lbl">Racha</span>
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
  const h    = habits.find(x => x.id === habitId);
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

function shiftDay(dir) {
  const nd = new Date(selDate + 'T00:00:00');
  nd.setDate(nd.getDate() + dir);
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
  btn.classList.toggle('active-state', done);
  document.getElementById('btnDoneLabel').textContent = done ? 'Completado ✓' : 'Marcar hecho';
}

// ══════════════════════════════════════════════════════
//  MARK DAY
// ══════════════════════════════════════════════════════
async function markDay(val) {
  // Optimistic UI update
  const existing = allData.find(l => l.habit_id === currentKey && l.fecha === selDate);
  if (existing) existing.value = val;
  else allData.push({ habit_id: currentKey, fecha: selDate, value: val });

  renderActionBtn();
  renderDetail();
  renderHome();
  showToast(val === 1 ? '¡Marcado! ✓' : 'Desmarcado');

  // Persist
  try {
    await sb('logs', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body:   { habit_id: currentKey, fecha: selDate, value: val },
    });
  } catch (e) {
    showToast('Error al guardar — sin conexión');
    console.error(e);
  }
}

// ══════════════════════════════════════════════════════
//  CALENDAR
// ══════════════════════════════════════════════════════
function renderCal() {
  const today = todayStr();
  const sel   = parseDate(selDate);
  const y     = sel.getFullYear(), m = sel.getMonth();
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const sdow  = (first.getDay() + 6) % 7; // Monday-first

  const ne = document.getElementById('calDayNames');
  const ce = document.getElementById('calCells');
  ne.innerHTML = ['L','M','X','J','V','S','D']
    .map(n => `<div class="cal-day-name">${n}</div>`).join('');
  ce.innerHTML = '';

  for (let i = 0; i < sdow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell empty'; ce.appendChild(e);
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
//  CHART — minimal style
// ══════════════════════════════════════════════════════
function renderChart() {
  const logs = allData.filter(l => l.habit_id === currentKey);
  const wm   = {};
  logs.forEach(l => {
    const w = 'S' + wkNum(parseDate(l.fecha));
    if (!wm[w]) wm[w] = { done: 0, total: 0 };
    wm[w].total++;
    if (l.value === 1) wm[w].done++;
  });

  const labels = Object.keys(wm).sort((a, b) =>
    parseInt(a.slice(1)) - parseInt(b.slice(1))
  );
  const data = labels.map(l => Math.round((wm[l].done / wm[l].total) * 100));

  const ctx = document.getElementById('weekChart').getContext('2d');
  if (wChart) wChart.destroy();

  wChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v => v >= 70 ? 'rgba(21,128,61,0.1)' : 'rgba(192,27,27,0.08)'),
        borderColor:     data.map(v => v >= 70 ? '#22C55E'              : '#EF4444'),
        borderWidth: 1.5,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: c => ` ${c.parsed.y}%` },
          backgroundColor:    '#1A1714',
          titleColor:         '#F5F3F0',
          bodyColor:          '#ABA79F',
          padding:            10,
          cornerRadius:       8,
          displayColors:      false,
          titleFont:          { family: 'DM Sans', weight: '600', size: 12 },
          bodyFont:           { family: 'DM Mono',  size: 13 },
        },
      },
      scales: {
        y: {
          min: 0, max: 100,
          ticks: {
            callback: v => v + '%',
            font:     { size: 10, family: 'DM Mono' },
            color:    '#ABA79F',
            stepSize: 50,
            maxTicksLimit: 3,
          },
          grid:   { color: 'rgba(26,23,20,0.05)' },
          border: { display: false },
        },
        x: {
          ticks: { font: { size: 10, family: 'DM Mono' }, color: '#ABA79F' },
          grid:   { display: false },
          border: { display: false },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════════
//  ADD HABIT MODAL
// ══════════════════════════════════════════════════════
function buildEmojiGrid(gridId, inputId, onSelect) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.className   = 'em-opt' + (em === onSelect() ? ' sel' : '');
    b.textContent  = em;
    b.onclick = () => {
      document.getElementById(inputId).value = '';
      grid.querySelectorAll('.em-opt').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      if (gridId === 'emojiGrid') selEmoji   = em;
      else                        editEmoji  = em;
    };
    grid.appendChild(b);
  });
  document.getElementById(inputId).oninput = function () {
    const v = this.value.trim();
    if (v) {
      grid.querySelectorAll('.em-opt').forEach(x => x.classList.remove('sel'));
      if (gridId === 'emojiGrid') selEmoji   = v;
      else                        editEmoji  = v;
    }
  };
}

function openAddModal() {
  document.getElementById('habitName').value   = '';
  document.getElementById('customEmoji').value = '';
  selEmoji = EMOJIS[0];
  buildEmojiGrid('emojiGrid', 'customEmoji', () => selEmoji);
  const btn = document.getElementById('submitHabit');
  btn.disabled = false; btn.textContent = 'Crear hábito';
  document.getElementById('addModal').classList.add('open');
  setTimeout(() => document.getElementById('habitName').focus(), 370);
}
function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

async function submitNewHabit() {
  const name  = document.getElementById('habitName').value.trim();
  const emoji = document.getElementById('customEmoji').value.trim() || selEmoji;
  if (!name) { showToast('Escribe un nombre'); return; }

  const btn = document.getElementById('submitHabit');
  btn.disabled = true; btn.textContent = 'Creando…';

  try {
    const result = await sb('habits', { method: 'POST', body: { name, emoji } });
    habits.push(result[0]);
    closeAddModal();
    renderHome();
    showToast(`"${name}" creado ✓`);
  } catch (e) {
    showToast('Error al crear hábito');
    console.error(e);
    btn.disabled = false; btn.textContent = 'Crear hábito';
  }
}

// ══════════════════════════════════════════════════════
//  EDIT HABIT MODAL
// ══════════════════════════════════════════════════════
function openEditModal() {
  const h = habits.find(x => x.id === currentKey);
  if (!h) return;
  editHabitId = currentKey;
  editEmoji   = h.emoji;

  document.getElementById('editHabitName').value   = h.name;
  document.getElementById('editCustomEmoji').value = '';
  buildEmojiGrid('editEmojiGrid', 'editCustomEmoji', () => editEmoji);

  // Highlight current emoji if it's in the preset grid
  const grid = document.getElementById('editEmojiGrid');
  grid.querySelectorAll('.em-opt').forEach(btn => {
    if (btn.textContent === h.emoji) btn.classList.add('sel');
  });

  const btn = document.getElementById('submitEdit');
  btn.disabled = false; btn.textContent = 'Guardar cambios';
  document.getElementById('editModal').classList.add('open');
  setTimeout(() => document.getElementById('editHabitName').focus(), 370);
}
function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function submitEditHabit() {
  const name  = document.getElementById('editHabitName').value.trim();
  const emoji = document.getElementById('editCustomEmoji').value.trim() || editEmoji;
  if (!name) { showToast('Escribe un nombre'); return; }

  const btn = document.getElementById('submitEdit');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    await sb(`habits?id=eq.${editHabitId}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body:   { name, emoji },
    });
    // Update local state
    const h = habits.find(x => x.id === editHabitId);
    if (h) { h.name = name; h.emoji = emoji; }
    // Update detail header
    document.getElementById('detailEmoji').textContent = emoji;
    document.getElementById('detailTitle').textContent = name;
    closeEditModal();
    renderHome();
    showToast('Hábito actualizado ✓');
  } catch (e) {
    showToast('Error al guardar');
    console.error(e);
    btn.disabled = false; btn.textContent = 'Guardar cambios';
  }
}

// ══════════════════════════════════════════════════════
//  DELETE HABIT
// ══════════════════════════════════════════════════════
function confirmDeleteHabit() {
  const h = habits.find(x => x.id === editHabitId);
  if (!h) return;
  if (!confirm(`¿Eliminar "${h.name}" y todos sus registros? Esta acción no se puede deshacer.`)) return;
  deleteHabit();
}

async function deleteHabit() {
  try {
    // Cascade delete handles logs (set up in Supabase schema)
    await sb(`habits?id=eq.${editHabitId}`, { method: 'DELETE', prefer: 'return=minimal' });
    habits  = habits.filter(h => h.id !== editHabitId);
    allData = allData.filter(l => l.habit_id !== editHabitId);
    closeEditModal();
    goHome();
    showToast('Hábito eliminado');
  } catch (e) {
    showToast('Error al eliminar');
    console.error(e);
  }
}

// ══════════════════════════════════════════════════════
//  SHARED
// ══════════════════════════════════════════════════════
function bgClick(e, id, fn) {
  if (e.target === document.getElementById(id)) fn();
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
syncData();
