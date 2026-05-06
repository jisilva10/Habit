// ══════════════════════════════════════════════════════
//  Habits App — Supabase Backend
//  ⚙️  Configura tus credenciales aquí:
// ══════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://jbjynxhcsmgftvjdrlxr.supabase.co';   // ← tu URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpianlueGhjc21nZnR2amRybHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzQxNjksImV4cCI6MjA5MjIxMDE2OX0.W6WLVzNuPqVmLElaSJPEuqPMM4X2rMKiahKOjuDET6M';                       // ← tu anon key

// Preset emojis
const EMOJIS = ['🐐','💪','💧','📚','🏃','🧘','🥗','😴','🎯','🧠','🚴','✍️'];

// ── State ──
let habits     = [];
let allData    = [];   // logs: [{id, habit_id, fecha, value}]
let currentKey = null; // active habit UUID
let editHabitId= null; // habit UUID being edited
let selDate    = todayStr();
let calViewDate= null; // {y, m} for calendar month navigation
let chartMode  = 'days'; // 'days' | 'weeks' | 'months'
let selEmoji   = EMOJIS[0];
let editEmoji  = EMOJIS[0];
let wChart     = null;

// ── Gym State ──
let gymRoutines = [];
let gymDays     = [];
let gymLogs     = [];
let selectedRoutineId = null;
let currentGymWeek = getWeekString(new Date());
let editDayIndex = null;


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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function parseDate(s) {
  return new Date(s + 'T00:00:00');
}
function wkNum(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
}
function getWeekString(date) {
  const y = date.getFullYear();
  const w = wkNum(date);
  return `${y}-W${String(w).padStart(2, '0')}`;
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
    const [h, l, gr, gd, gl] = await Promise.all([
      sb('habits?select=*&order=created_at'),
      sb('logs?select=*&order=fecha'),
      sb('gym_routines?select=*&order=created_at'),
      sb('gym_days?select=*&order=day_index'),
      sb('gym_logs?select=*')
    ]);
    habits      = Array.isArray(h) ? h : [];
    allData     = Array.isArray(l) ? l : [];
    gymRoutines = Array.isArray(gr) ? gr : [];
    gymDays     = Array.isArray(gd) ? gd : [];
    gymLogs     = Array.isArray(gl) ? gl : [];
    
    if (gymRoutines.length > 0 && !selectedRoutineId) {
      selectedRoutineId = gymRoutines[0].id;
    }

    console.log(`✓ Supabase OK — ${habits.length} hábitos, ${gymRoutines.length} rutinas`);
  } catch (e) {
    console.error('Supabase error:', e.message);
    // Diagnose the type of error
    if (e.message.includes('42P01') || e.message.includes('does not exist')) {
      showToast('❌ Tablas no creadas — corre el SQL en Supabase');
    } else if (e.message.includes('401') || e.message.includes('Invalid API key')) {
      showToast('❌ API key inválido — revisa las credenciales');
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      showToast('❌ Sin conexión a internet');
    } else {
      showToast(`❌ Error: ${e.message.slice(0, 60)}`);
    }
    loadFallback();
  }
  renderHome();
  renderGym();
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

  // Map de fecha → valor para lookup rápido
  const byDate = {};
  sorted.forEach(l => { byDate[l.fecha] = l.value; });

  // ── Racha actual: días consecutivos hacia atrás desde hoy ──
  // Si hoy no tiene registro (undefined), vemos desde ayer sin romper la racha.
  // Si cualquier día pasado es undefined o 0, rompe la racha.
  let cur = 0;
  const todayDateStr = todayStr();
  const d = new Date(todayDateStr + 'T00:00:00');
  while (true) {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const ds = `${y}-${mo}-${dy}`;
    if (byDate[ds] === 1) {
      cur++;
      d.setDate(d.getDate() - 1);
    } else if (byDate[ds] === undefined && ds === todayDateStr) {
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Mejor racha histórica ──
  // Itera cada día del calendario entre el primer y último log,
  // así los días sin registro rompen la racha correctamente.
  let best = 0;
  if (sorted.length > 0) {
    const firstDate = parseDate(sorted[0].fecha);
    const lastDate  = parseDate(todayStr());
    let streak = 0;
    const iter = new Date(firstDate);
    while (iter <= lastDate) {
      const y  = iter.getFullYear();
      const mo = String(iter.getMonth() + 1).padStart(2, '0');
      const dy = String(iter.getDate()).padStart(2, '0');
      const ds = `${y}-${mo}-${dy}`;
      if (byDate[ds] === 1) {
        streak++;
        if (streak > best) best = streak;
      } else {
        streak = 0;
      }
      iter.setDate(iter.getDate() + 1);
    }
  }


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
  currentKey  = habitId;
  selDate     = todayStr();
  const td    = parseDate(selDate);
  calViewDate = { y: td.getFullYear(), m: td.getMonth() };
  chartMode   = 'days';
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
  const val = getLogValue(currentKey, selDate);
  const isDone   = val === 1;
  const isMiss   = val === 0;
  const isNeutral = val === undefined;

  const btnDone   = document.getElementById('btnDone');
  const btnUndone = document.getElementById('btnUndone');
  const btnNeutral= document.getElementById('btnNeutral');

  btnDone.classList.toggle('active-state', isDone);
  btnUndone.classList.toggle('active-state', isMiss);
  if (btnNeutral) btnNeutral.classList.toggle('active-state', isNeutral);
}

// ══════════════════════════════════════════════════════
//  MARK DAY
// ══════════════════════════════════════════════════════
async function markDay(val) {
  if (val === -1) {
    // Neutral: remove log entry
    allData = allData.filter(l => !(l.habit_id === currentKey && l.fecha === selDate));
    renderActionBtn();
    renderDetail();
    renderHome();
    showToast('Sin dato — registro eliminado');
    try {
      await sb(`logs?habit_id=eq.${currentKey}&fecha=eq.${selDate}`, {
        method: 'DELETE',
        prefer: 'return=minimal',
      });
    } catch (e) {
      showToast(`❌ ${e.message.slice(0, 60)}`);
      console.error('markDay delete error:', e);
    }
    return;
  }

  // Optimistic UI update
  const existing = allData.find(l => l.habit_id === currentKey && l.fecha === selDate);
  if (existing) existing.value = val;
  else allData.push({ habit_id: currentKey, fecha: selDate, value: val });

  renderActionBtn();
  renderDetail();
  renderHome();
  showToast(val === 1 ? '¡Marcado! ✓' : 'No hecho');

  // Persist — on_conflict especifica la restricción unique (habit_id, fecha)
  try {
    await sb('logs?on_conflict=habit_id,fecha', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body:   { habit_id: currentKey, fecha: selDate, value: val },
    });
  } catch (e) {
    showToast(`❌ ${e.message.slice(0, 60)}`);
    console.error('markDay error:', e);
  }
}

// ══════════════════════════════════════════════════════
//  CALENDAR — with month navigation
// ══════════════════════════════════════════════════════
function shiftCalMonth(dir) {
  calViewDate.m += dir;
  if (calViewDate.m > 11) { calViewDate.m = 0;  calViewDate.y++; }
  if (calViewDate.m < 0)  { calViewDate.m = 11; calViewDate.y--; }
  renderCal();
}

function renderCal() {
  const today = todayStr();
  const { y, m } = calViewDate;
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const sdow  = (first.getDay() + 6) % 7; // Monday-first

  // Update month label
  const label = first.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  document.getElementById('calMonthLabel').textContent =
    label.charAt(0).toUpperCase() + label.slice(1);

  // Disable next month if it's in the future
  const nowY = new Date().getFullYear(), nowM = new Date().getMonth();
  document.getElementById('nextMonth').disabled = (y > nowY || (y === nowY && m >= nowM));

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
    const ds       = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isFut    = ds > today;
    const isToday  = ds === today;
    const isSel    = ds === selDate;
    const val      = getLogValue(currentKey, ds);

    let cls = 'cal-cell';
    if (isFut)                  cls += ' future';
    else if (val === 1)         cls += ' done-day';
    else if (val !== undefined) cls += ' miss-day';
    if (isToday)  cls += ' today-cell';
    if (isSel)    cls += ' sel-day';

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
//  CHART — 3 modes: days / weeks / months
// ══════════════════════════════════════════════════════
function setChartMode(mode) {
  chartMode = mode;
  ['days','weeks','months'].forEach(m => {
    const el = document.getElementById(`tab${m.charAt(0).toUpperCase()+m.slice(1)}`);
    if (el) el.classList.toggle('active', m === mode);
  });
  renderChart();
}

function chartColors(n, isCur, maxVal) {
  const ratio = maxVal > 0 ? n / maxVal : 0;
  const alpha  = isCur ? 0.08 : 0.12;
  const salpha = isCur ? 0.40 : 0.70;
  if (ratio >= 0.85) return { fill: `rgba(22,101,52,${alpha})`,   stroke: `rgba(22,101,52,${salpha})` };
  if (ratio >= 0.55) return { fill: `rgba(34,197,94,${alpha})`,   stroke: `rgba(34,197,94,${salpha})` };
  if (ratio >= 0.25) return { fill: `rgba(202,138,4,${alpha})`,   stroke: `rgba(202,138,4,${salpha})` };
  return                    { fill: `rgba(185,28,28,${alpha})`,   stroke: `rgba(185,28,28,${salpha})` };
}

function renderChart() {
  const logs = allData.filter(l => l.habit_id === currentKey);
  const today = todayStr();
  const ctx   = document.getElementById('weekChart').getContext('2d');
  if (wChart) wChart.destroy();

  let labels, counts, isCurrent, maxY, tooltipLabel;

  // ── MODE: DAYS (last 35 days) ──
  if (chartMode === 'days') {
    const days = [];
    for (let i = 34; i >= 0; i--) {
      const d  = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (ds > today) continue;
      const val = getLogValue(currentKey, ds);
      const shortLabel = d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
      days.push({ label: shortLabel, done: val === 1 ? 1 : 0, isCur: ds === today });
    }
    labels    = days.map(d => d.label);
    counts    = days.map(d => d.done);
    isCurrent = days.map(d => d.isCur);
    maxY      = 1;
    tooltipLabel = c => `  ${c.parsed.y === 1 ? 'Completado ✓' : 'No completado'}`;
  }

  // ── MODE: WEEKS ──
  else if (chartMode === 'weeks') {
    const wm = {};
    logs.forEach(l => {
      const d   = parseDate(l.fecha);
      const wk  = wkNum(d);
      const yr  = d.getFullYear();
      const key = `${yr}-${String(wk).padStart(2,'0')}`;
      if (!wm[key]) wm[key] = { label: `Sem ${wk}`, done: 0, year: yr, week: wk };
      if (l.value === 1) wm[key].done++;
    });
    const sorted = Object.entries(wm).sort(([a],[b]) => a.localeCompare(b));
    const nowWk  = wkNum(new Date()), nowYr = new Date().getFullYear();
    labels    = sorted.map(([,v]) => v.label);
    counts    = sorted.map(([,v]) => v.done);
    isCurrent = sorted.map(([,v]) => v.week === nowWk && v.year === nowYr);
    maxY      = 7;
    tooltipLabel = c => `  ${c.parsed.y} / 7 días ✓`;
  }

  // ── MODE: MONTHS ──
  else {
    const mm = {};
    logs.forEach(l => {
      const d   = parseDate(l.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!mm[key]) {
        const lbl = d.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' });
        mm[key] = { label: lbl.charAt(0).toUpperCase() + lbl.slice(1), done: 0, total: 0 };
      }
      mm[key].total++;
      if (l.value === 1) mm[key].done++;
    });
    const sorted = Object.entries(mm).sort(([a],[b]) => a.localeCompare(b));
    const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    labels    = sorted.map(([,v]) => v.label);
    counts    = sorted.map(([,v]) => v.done);
    isCurrent = sorted.map(([k]) => k === nowKey);
    maxY      = Math.max(...sorted.map(([,v]) => v.total), 1);
    tooltipLabel = (c, i) => {
      const v = sorted[c.dataIndex];
      return v ? `  ${c.parsed.y} / ${v[1].total} días ✓` : '';
    };
  }

  const maxVal = Math.max(...counts, 1);
  const bgs    = counts.map((c,i) => chartColors(c, isCurrent[i], chartMode === 'days' ? 1 : maxY).fill);
  const bds    = counts.map((c,i) => chartColors(c, isCurrent[i], chartMode === 'days' ? 1 : maxY).stroke);

  wChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:            counts,
        backgroundColor: bgs,
        borderColor:     bds,
        borderWidth:     1.5,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => {
              const i = items[0].dataIndex;
              return isCurrent[i] ? `${labels[i]}  (en curso)` : labels[i];
            },
            label: tooltipLabel,
          },
          backgroundColor: '#111110',
          titleColor:      '#F4F2EF',
          bodyColor:       '#A39F97',
          padding:         10,
          cornerRadius:    8,
          displayColors:   false,
          titleFont: { family: 'Inter', weight: '600', size: 12 },
          bodyFont:  { family: 'DM Mono', size: 13 },
        },
      },
      scales: {
        y: {
          min: 0,
          max: chartMode === 'days' ? 1 : maxY,
          ticks: {
            stepSize: chartMode === 'days' ? 1 : 1,
            font:     { size: 10, family: 'DM Mono' },
            color:    '#A39F97',
            callback: v => {
              if (chartMode === 'days') return v === 1 ? '✓' : '';
              if (v === maxY) return `${maxY} ✓`;
              return v === 0 ? '' : String(v);
            },
          },
          grid:   { color: 'rgba(17,17,16,0.04)', drawTicks: false },
          border: { display: false },
        },
        x: {
          ticks: {
            font:        { size: 9, family: 'DM Mono' },
            color:       '#A39F97',
            maxRotation: chartMode === 'days' ? 45 : 0,
            maxTicksLimit: chartMode === 'days' ? 12 : 24,
          },
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
  document.body.classList.add('no-scroll');
  setTimeout(() => document.getElementById('habitName').focus(), 370);
}
function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
  document.body.classList.remove('no-scroll');
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
  document.body.classList.add('no-scroll');
  setTimeout(() => document.getElementById('editHabitName').focus(), 370);
}
function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  document.body.classList.remove('no-scroll');
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
//  GYM TRACKER LOGIC
// ══════════════════════════════════════════════════════
function switchNav(tab) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
}

function getGymLogValue(routineId, dayIndex, weekId) {
  const log = gymLogs.find(l => l.routine_id === routineId && l.day_index === dayIndex && l.week_id === weekId);
  return log ? log.status : undefined;
}

function renderGym() {
  const scroll = document.getElementById('gymRoutinesScroll');
  if(!scroll) return;
  scroll.innerHTML = '';
  
  if (gymRoutines.length === 0) {
    document.getElementById('gymGridContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Sin splits</div>
        <div class="empty-sub">Toca <strong>+</strong> para crear tu primer split.</div>
      </div>
    `;
    document.getElementById('gymWeekScore').textContent = '—';
    document.getElementById('gymWeekPct').textContent = '0% completado';
    return;
  }

  gymRoutines.forEach(r => {
    const btn = document.createElement('button');
    btn.className = `gym-routine-tab ${r.id === selectedRoutineId ? 'active' : ''}`;
    btn.textContent = r.name;
    btn.onclick = () => {
      selectedRoutineId = r.id;
      renderGym();
    };
    scroll.appendChild(btn);
  });

  const routine = gymRoutines.find(r => r.id === selectedRoutineId);
  if (!routine) return;

  const container = document.getElementById('gymGridContainer');
  container.innerHTML = '';

  let doneCount = 0;

  for (let i = 0; i < routine.days_count; i++) {
    const dayData = gymDays.find(d => d.routine_id === routine.id && d.day_index === i);
    const title = dayData && dayData.title ? dayData.title : `Día ${i + 1}`;
    const content = dayData ? dayData.content : '';
    const status = getGymLogValue(routine.id, i, currentGymWeek);

    if (status === 1) doneCount++;

    const isDone = status === 1;
    const isMiss = status === 0;

    const card = document.createElement('div');
    card.className = `habit-card ${isDone ? 'status-done' : isMiss ? 'status-miss' : ''}`;

    const safeTitle = title.replace(/'/g, "\\'");
    const safeContent = content.replace(/`/g, '\\`').replace(/'/g, "\\'");
    
    card.innerHTML = `
      <div class="card-strip"></div>
      <div class="card-top">
        <div class="card-name" style="font-size: 16px;">${title}</div>
        <div class="card-status-dot"></div>
      </div>
      <div class="card-bar-track">
        <div class="card-bar-fill" style="width:${isDone ? '100%' : '0%'}"></div>
      </div>
      <div class="card-footer">
        <span class="card-pct ${isDone ? 'high' : isMiss ? 'low' : ''}">${isDone ? '✓' : isMiss ? '✗' : '-'}</span>
      </div>
    `;
    card.onclick = () => openGymDetail(i, safeTitle, safeContent);
    container.appendChild(card);
  }

  document.getElementById('gymWeekLabel').textContent = currentGymWeek;
  document.getElementById('gymWeekScore').textContent = `${doneCount}/${routine.days_count}`;
  const pct = Math.round((doneCount / routine.days_count) * 100) || 0;
  document.getElementById('gymWeekPct').textContent = `${pct}% completado`;
}

function openAddGymRoutineModal() {
  document.getElementById('gymRoutineName').value = '';
  document.getElementById('gymRoutineDays').value = '3';
  document.getElementById('submitGymRoutine').disabled = false;
  document.getElementById('submitGymRoutine').textContent = 'Crear Split';
  document.getElementById('addGymRoutineModal').classList.add('open');
  document.body.classList.add('no-scroll');
}

function closeAddGymRoutineModal() {
  document.getElementById('addGymRoutineModal').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

async function submitNewGymRoutine() {
  const name = document.getElementById('gymRoutineName').value.trim();
  const days_count = parseInt(document.getElementById('gymRoutineDays').value);
  if (!name || isNaN(days_count) || days_count < 1 || days_count > 7) {
    showToast('Ingresa un nombre y de 1 a 7 días');
    return;
  }

  const btn = document.getElementById('submitGymRoutine');
  btn.disabled = true;
  btn.textContent = 'Creando...';

  try {
    const result = await sb('gym_routines', { method: 'POST', body: { name, days_count } });
    gymRoutines.push(result[0]);
    selectedRoutineId = result[0].id;
    closeAddGymRoutineModal();
    renderGym();
    showToast(`Split "${name}" creado`);
  } catch (e) {
    showToast('Error al crear split');
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Crear Split';
  }
}

function openGymDetail(index, title, content) {
  editDayIndex = index;
  document.getElementById('gymDetailTitle').value = title;
  document.getElementById('gymDetailContent').value = content;
  
  // Render active states of buttons
  const status = getGymLogValue(selectedRoutineId, index, currentGymWeek);
  document.getElementById('gymBtnDone').classList.toggle('active', status === 1);
  document.getElementById('gymBtnNeutral').classList.toggle('active', status === undefined);
  document.getElementById('gymBtnUndone').classList.toggle('active', status === 0);

  document.getElementById('gym').classList.remove('active');
  document.getElementById('gymDetail').classList.add('active');
}

function closeGymDetail() {
  document.getElementById('gymDetail').classList.remove('active');
  document.getElementById('gym').classList.add('active');
  editDayIndex = null;
  renderGym();
}

async function submitEditGymDay() {
  const title = document.getElementById('gymDetailTitle').value.trim() || `Día ${editDayIndex + 1}`;
  const content = document.getElementById('gymDetailContent').value.trim();

  try {
    const existing = gymDays.find(d => d.routine_id === selectedRoutineId && d.day_index === editDayIndex);
    if (existing) {
      await sb(`gym_days?id=eq.${existing.id}`, { method: 'PATCH', body: { title, content } });
      existing.title = title;
      existing.content = content;
    } else {
      const res = await sb('gym_days', { method: 'POST', body: { routine_id: selectedRoutineId, day_index: editDayIndex, title, content } });
      gymDays.push(res[0]);
    }
    showToast('Día guardado');
  } catch(e) {
    showToast('Error al guardar');
    console.error(e);
  }
}

async function markGymDay(val) {
  if (!selectedRoutineId || editDayIndex === null) return;
  const dayIndex = editDayIndex;

  // Update UI buttons optimistically
  document.getElementById('gymBtnDone').classList.toggle('active', val === 1);
  document.getElementById('gymBtnNeutral').classList.toggle('active', val === -1 || val === undefined);
  document.getElementById('gymBtnUndone').classList.toggle('active', val === 0);

  if (val === -1) {
    gymLogs = gymLogs.filter(l => !(l.routine_id === selectedRoutineId && l.day_index === dayIndex && l.week_id === currentGymWeek));
    showToast('Sin dato');
    try {
      await sb(`gym_logs?routine_id=eq.${selectedRoutineId}&day_index=eq.${dayIndex}&week_id=eq.${currentGymWeek}`, { method: 'DELETE', prefer: 'return=minimal' });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const existing = gymLogs.find(l => l.routine_id === selectedRoutineId && l.day_index === dayIndex && l.week_id === currentGymWeek);
  if (existing) existing.status = val;
  else gymLogs.push({ routine_id: selectedRoutineId, day_index: dayIndex, week_id: currentGymWeek, status: val });

  showToast(val === 1 ? '¡Día completado! ✓' : 'No hecho');

  try {
    await sb('gym_logs?on_conflict=routine_id,day_index,week_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: { routine_id: selectedRoutineId, day_index: dayIndex, week_id: currentGymWeek, status: val },
    });
  } catch (e) {
    console.error(e);
  }
}

let gymChartInstance = null;
function openGymCalendarModal() {
  document.getElementById('gymCalendarModal').classList.add('open');
  document.body.classList.add('no-scroll');
  renderGymChart();
}
function closeGymCalendarModal() {
  document.getElementById('gymCalendarModal').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

function renderGymChart() {
  if (!selectedRoutineId) return;
  const routine = gymRoutines.find(r => r.id === selectedRoutineId);
  if (!routine) return;

  const logs = gymLogs.filter(l => l.routine_id === selectedRoutineId);
  
  // Group by week
  const wm = {};
  logs.forEach(l => {
    if(!wm[l.week_id]) wm[l.week_id] = 0;
    if(l.status === 1) wm[l.week_id]++;
  });

  // Get last 8 weeks based on current week
  const today = new Date();
  const weeks = [];
  for(let i=7; i>=0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - (i * 7));
    const wStr = getWeekString(d);
    weeks.push({ label: wStr, done: wm[wStr] || 0 });
  }

  const labels = weeks.map(w => w.label);
  const counts = weeks.map(w => w.done);
  
  const ctx = document.getElementById('gymChart').getContext('2d');
  if (gymChartInstance) gymChartInstance.destroy();

  const maxDays = routine.days_count;
  const bgs = counts.map(c => c === maxDays ? 'rgba(34,197,94,0.12)' : c > 0 ? 'rgba(202,138,4,0.12)' : 'rgba(17,17,16,0.05)');
  const bds = counts.map(c => c === maxDays ? 'rgba(34,197,94,0.7)' : c > 0 ? 'rgba(202,138,4,0.7)' : 'rgba(17,17,16,0.15)');

  gymChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: bgs,
        borderColor: bds,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0,
          max: maxDays,
          ticks: { stepSize: 1, color: '#A39F97', font: { family: 'DM Mono', size: 10 } },
          grid: { color: 'rgba(17,17,16,0.04)' }
        },
        x: {
          ticks: { color: '#A39F97', font: { family: 'DM Mono', size: 9 }, maxRotation: 45 }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

syncData();
