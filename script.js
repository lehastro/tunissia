'use strict';

/* ============================================================
   РАСПИСАНИЕ — round-robin doubles для 5 игроков
   Каждая запись: { sit: индекс сидящего, a: [i, j], b: [k, l] }
   Всего 15 матчей. Каждый играет 12 и сидит 3. Каждая пара
   игроков партнёрит ровно 3 раза, играет против каждого 6 раз.
   Порядок отсадки чередуется 0→1→2→3→4 чтобы один и тот же
   игрок не сидел три раза подряд.
   ============================================================ */
const SCHEDULE = [
  { sit: 0, a: [1, 4], b: [3, 2] },  //  1: Игрок2+Игрок5 vs Игрок4+Игрок3
  { sit: 1, a: [0, 3], b: [2, 4] },  //  2: Игрок1+Игрок4 vs Игрок3+Игрок5
  { sit: 2, a: [4, 3], b: [0, 1] },  //  3: Игрок5+Игрок4 vs Игрок1+Игрок2
  { sit: 3, a: [1, 2], b: [4, 0] },  //  4: Игрок2+Игрок3 vs Игрок5+Игрок1
  { sit: 4, a: [0, 2], b: [1, 3] },  //  5: Игрок1+Игрок3 vs Игрок2+Игрок4
  { sit: 0, a: [1, 2], b: [3, 4] },  //  6: Игрок2+Игрок3 vs Игрок4+Игрок5
  { sit: 1, a: [0, 4], b: [2, 3] },  //  7: Игрок1+Игрок5 vs Игрок3+Игрок4
  { sit: 2, a: [4, 1], b: [0, 3] },  //  8: Игрок5+Игрок2 vs Игрок1+Игрок4
  { sit: 3, a: [1, 0], b: [2, 4] },  //  9: Игрок2+Игрок1 vs Игрок3+Игрок5
  { sit: 4, a: [0, 3], b: [1, 2] },  // 10: Игрок1+Игрок4 vs Игрок2+Игрок3
  { sit: 0, a: [1, 3], b: [2, 4] },  // 11: Игрок2+Игрок4 vs Игрок3+Игрок5
  { sit: 1, a: [0, 2], b: [3, 4] },  // 12: Игрок1+Игрок3 vs Игрок4+Игрок5
  { sit: 2, a: [4, 0], b: [1, 3] },  // 13: Игрок5+Игрок1 vs Игрок2+Игрок4
  { sit: 3, a: [1, 4], b: [0, 2] },  // 14: Игрок2+Игрок5 vs Игрок1+Игрок3
  { sit: 4, a: [0, 1], b: [2, 3] },  // 15: Игрок1+Игрок2 vs Игрок3+Игрок4
];

const STORAGE_KEY = 'tunissia.v1';
const PLAYERS_COUNT = 5;

/* ============================================================
   STATE — единственный источник истины
   ============================================================ */
let state = {
  players: ['', '', '', '', ''],
  results: [],   // [{ a, b }] — счёт пары А и пары Б по индексу матча
  phase: 'setup' // 'setup' | 'game' | 'done'
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.players) && parsed.players.length === PLAYERS_COUNT) {
      state = { ...state, ...parsed };
    }
  } catch (e) {
    console.warn('localStorage load failed:', e);
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}
function reset() {
  state = { players: ['', '', '', '', ''], results: [], phase: 'setup' };
  save();
}

/* ============================================================
   ВЫЧИСЛЕНИЯ — табло из state.results
   ============================================================ */
function computeStandings() {
  const stats = state.players.map((name, idx) => ({
    idx, name, wins: 0, diff: 0, played: 0
  }));

  state.results.forEach((r, matchIdx) => {
    const match = SCHEDULE[matchIdx];
    const teamA = match.a;
    const teamB = match.b;
    const margin = r.a - r.b; // положительный = победа А

    teamA.forEach(p => {
      stats[p].played++;
      stats[p].diff += margin;
      if (margin > 0) stats[p].wins++;
    });
    teamB.forEach(p => {
      stats[p].played++;
      stats[p].diff += -margin;
      if (margin < 0) stats[p].wins++;
    });
  });

  // Сортировка: победы desc → разница desc → имя asc
  stats.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.diff !== x.diff) return y.diff - x.diff;
    return x.name.localeCompare(y.name);
  });

  return stats;
}

/* ============================================================
   ВСПОМОГАТЕЛЬНОЕ
   ============================================================ */
const $ = (sel) => document.querySelector(sel);

function teamLabel(team) {
  return team.map(i => state.players[i] || `Игрок ${i + 1}`).join(' + ');
}

function fmtDiff(d) {
  if (d === 0) return '0';
  return d > 0 ? '+' + d : String(d);
}

/* ============================================================
   РЕНДЕР
   ============================================================ */
function showView(phase) {
  $('#view-setup').hidden = phase !== 'setup';
  $('#view-game').hidden  = phase !== 'game';
  $('#view-done').hidden  = phase !== 'done';
  $('#reset-btn').hidden  = phase === 'setup';
}

function renderSetup() {
  document.querySelectorAll('.input--name').forEach((input, idx) => {
    input.value = state.players[idx] || '';
  });
}

function renderGame() {
  const matchIdx = state.results.length;

  // Если все 15 сыграны — переход в done
  if (matchIdx >= SCHEDULE.length) {
    state.phase = 'done';
    save();
    showView('done');
    renderDone();
    return;
  }

  const match = SCHEDULE[matchIdx];

  // Текущая партия
  $('#match-num').textContent = `Партия ${matchIdx + 1} / ${SCHEDULE.length}`;
  $('#match-sit').innerHTML = `Сидит: <strong>${state.players[match.sit]}</strong>`;
  $('#team-a-players').textContent = teamLabel(match.a);
  $('#team-b-players').textContent = teamLabel(match.b);

  // Очистить и сфокусировать ввод
  const scoreA = $('#score-a');
  const scoreB = $('#score-b');
  scoreA.value = '';
  scoreB.value = '';
  // Не фокусируемся автоматически — на iOS клавиатура мешает

  // Undo доступно если есть что отменять
  $('#undo-btn').disabled = state.results.length === 0;

  renderStandings();
  renderHistory();
  renderMatrix('matrix-game', 'matrix-card');
}

function renderStandings() {
  const stats = computeStandings();
  const tbody = $('#standings-body');
  tbody.innerHTML = stats.map((s, rank) => {
    const isLeader = rank === 0 && s.played > 0;
    const diffClass = s.diff > 0 ? 'standings__diff--pos' : s.diff < 0 ? 'standings__diff--neg' : '';
    return `
      <tr class="${isLeader ? 'is-leader' : ''}">
        <td class="standings__rank">${rank + 1}</td>
        <td class="standings__name">${escapeHtml(s.name)}</td>
        <td class="standings__wins">${s.wins}</td>
        <td class="standings__diff ${diffClass}">${fmtDiff(s.diff)}</td>
        <td class="standings__played">${s.played}</td>
      </tr>
    `;
  }).join('');
}

function renderMatrix(targetId, showCardId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (showCardId) {
    const card = document.getElementById(showCardId);
    if (card) card.hidden = state.results.length === 0;
  }
  if (state.results.length === 0) {
    target.innerHTML = '';
    return;
  }

  // Игроки в порядке текущего рейтинга
  const stats = computeStandings();
  const totalMatches = SCHEDULE.length;

  // Заголовок: имя | 1..15 | П | ±
  let html = '<thead><tr><th class="matrix__name">Игрок</th>';
  for (let i = 1; i <= totalMatches; i++) {
    html += `<th class="matrix__col">${i}</th>`;
  }
  html += '<th class="matrix__total">П</th><th class="matrix__total">±</th></tr></thead><tbody>';

  for (const s of stats) {
    html += `<tr><td class="matrix__name">${escapeHtml(s.name)}</td>`;
    for (let m = 0; m < totalMatches; m++) {
      const match = SCHEDULE[m];
      if (match.sit === s.idx) {
        html += '<td class="matrix__cell matrix__cell--sat"></td>';
        continue;
      }
      const result = state.results[m];
      if (!result) {
        html += '<td class="matrix__cell matrix__cell--empty"></td>';
        continue;
      }
      const inA = match.a.includes(s.idx);
      const diff = inA ? (result.a - result.b) : (result.b - result.a);
      const cls = diff > 0 ? 'matrix__cell--won' : 'matrix__cell--lost';
      const label = diff > 0 ? '+' + diff : String(diff);
      html += `<td class="matrix__cell ${cls}">${label}</td>`;
    }
    html += `<td class="matrix__total">${s.wins}</td>`;
    html += `<td class="matrix__total">${fmtDiff(s.diff)}</td>`;
    html += '</tr>';
  }
  html += '</tbody>';

  target.innerHTML = html;
}

// Индекс партии, которую сейчас редактируем (-1 если ничего)
let editingMatchIdx = -1;

function renderHistory() {
  const card = $('#history-card');
  if (state.results.length === 0) {
    if (card) card.hidden = true;
    editingMatchIdx = -1;
    return;
  }
  if (card) card.hidden = false;
  // Показываем в обратном порядке: последняя партия сверху
  const items = state.results.map((r, idx) => {
    const m = SCHEDULE[idx];
    const aWin = r.a > r.b;
    const aHtml = `<span class="${aWin ? 'win' : ''}">${escapeHtml(teamLabel(m.a))}</span>`;
    const bHtml = `<span class="${!aWin ? 'win' : ''}">${escapeHtml(teamLabel(m.b))}</span>`;

    if (idx === editingMatchIdx) {
      // Режим редактирования: счёт превращается в два инпута
      return `
        <li class="history__item history__item--editing" data-idx="${idx}">
          <span class="history__n">#${idx + 1}</span>
          <span class="history__teams">${escapeHtml(teamLabel(m.a))} <small>vs</small> ${escapeHtml(teamLabel(m.b))}</span>
          <span class="history__edit">
            <input type="number" class="history__edit-score" data-team="a" value="${r.a}" min="0" max="30" inputmode="numeric">
            <span class="history__edit-sep">:</span>
            <input type="number" class="history__edit-score" data-team="b" value="${r.b}" min="0" max="30" inputmode="numeric">
            <button type="button" class="history__edit-ok" data-idx="${idx}" aria-label="Сохранить">✓</button>
            <button type="button" class="history__edit-cancel" aria-label="Отмена">×</button>
          </span>
        </li>
      `;
    }

    return `
      <li class="history__item" data-idx="${idx}">
        <span class="history__n">#${idx + 1}</span>
        <span class="history__teams">${aHtml} <small>vs</small> ${bHtml}</span>
        <button type="button" class="history__score" data-idx="${idx}" aria-label="Изменить счёт">${r.a}:${r.b}</button>
      </li>
    `;
  }).reverse().join('');
  // Рендерим в оба списка (один на game-view, второй на done-view)
  document.querySelectorAll('#history-list-game, #history-list-done').forEach(el => {
    el.innerHTML = items;
  });
}

function onHistoryClick(e) {
  const t = e.target;

  // Клик по счёту → открыть в режим редактирования
  if (t.classList.contains('history__score')) {
    editingMatchIdx = parseInt(t.dataset.idx, 10);
    renderHistory();
    // Сфокусируемся на первом инпуте новой строки
    const firstInput = document.querySelector('.history__item--editing .history__edit-score');
    if (firstInput) { firstInput.focus(); firstInput.select(); }
    return;
  }

  // ✓ — сохранить изменения
  if (t.classList.contains('history__edit-ok')) {
    saveEdit(parseInt(t.dataset.idx, 10));
    return;
  }

  // × — отменить
  if (t.classList.contains('history__edit-cancel')) {
    editingMatchIdx = -1;
    renderHistory();
    return;
  }
}

function onHistoryKeydown(e) {
  if (!e.target.classList.contains('history__edit-score')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    const li = e.target.closest('.history__item--editing');
    if (li) saveEdit(parseInt(li.dataset.idx, 10));
  } else if (e.key === 'Escape') {
    editingMatchIdx = -1;
    renderHistory();
  }
}

function saveEdit(idx) {
  const li = document.querySelector(`.history__item--editing[data-idx="${idx}"]`);
  if (!li) return;
  const inputs = li.querySelectorAll('.history__edit-score');
  const a = parseInt(inputs[0].value, 10);
  const b = parseInt(inputs[1].value, 10);
  if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
    alert('Счёт — целые числа от 0');
    return;
  }
  if (a === b) {
    alert('Ничьих не бывает — кто-то должен выиграть');
    return;
  }
  state.results[idx] = { a, b };
  save();
  editingMatchIdx = -1;
  // Перерисовываем всё что зависит от результатов
  renderHistory();
  renderStandings();
  renderMatrix('matrix-game', 'matrix-card');
  // Если мы на финальном экране — обновим и его
  if (state.phase === 'done') renderDone();
}

function renderDone() {
  const stats = computeStandings();
  // Подиум — топ 3
  const podium = $('#podium');
  const medals = ['🥇', '🥈', '🥉'];
  podium.innerHTML = stats.slice(0, 3).map((s, i) => `
    <li>
      <span class="podium__pos">${medals[i]}</span>
      <span class="podium__name">${escapeHtml(s.name)}</span>
      <span class="podium__stats">${s.wins} побед · ${fmtDiff(s.diff)}</span>
    </li>
  `).join('');

  // Финальное табло
  const tbody = $('#standings-final-body');
  tbody.innerHTML = stats.map((s, rank) => {
    const diffClass = s.diff > 0 ? 'standings__diff--pos' : s.diff < 0 ? 'standings__diff--neg' : '';
    return `
      <tr>
        <td class="standings__rank">${rank + 1}</td>
        <td class="standings__name">${escapeHtml(s.name)}</td>
        <td class="standings__wins">${s.wins}</td>
        <td class="standings__diff ${diffClass}">${fmtDiff(s.diff)}</td>
      </tr>
    `;
  }).join('');

  renderMatrix('matrix-done');
  renderHistory();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

/* ============================================================
   ОБРАБОТЧИКИ
   ============================================================ */
function onSetupSubmit(e) {
  e.preventDefault();
  const names = Array.from(document.querySelectorAll('.input--name'))
    .map(i => i.value.trim());

  if (names.some(n => !n)) {
    alert('Заполни все 5 имён');
    return;
  }
  // Уникальность имён (если два игрока с одним именем — путаница в истории)
  const uniq = new Set(names);
  if (uniq.size !== names.length) {
    alert('Имена должны быть разные');
    return;
  }

  state.players = names;
  state.results = [];
  state.phase = 'game';
  save();
  showView('game');
  renderGame();
}

function onSaveMatch() {
  const aStr = $('#score-a').value.trim();
  const bStr = $('#score-b').value.trim();
  if (aStr === '' || bStr === '') {
    alert('Введи оба счёта');
    return;
  }
  const a = parseInt(aStr, 10);
  const b = parseInt(bStr, 10);
  if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
    alert('Счёт — целые числа от 0');
    return;
  }
  if (a === b) {
    alert('Ничьих не бывает — кто-то должен выиграть');
    return;
  }

  state.results.push({ a, b });
  save();
  renderGame();
}

function onUndo() {
  if (state.results.length === 0) return;
  if (!confirm('Отменить последнюю партию?')) return;
  state.results.pop();
  // Если были на экране done — возвращаемся в game
  if (state.phase === 'done') {
    state.phase = 'game';
    showView('game');
  }
  save();
  renderGame();
}

function onReset() {
  if (!confirm('Начать новый турнир? Текущие результаты будут стёрты.')) return;
  reset();
  showView('setup');
  renderSetup();
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
/* ============================================================
   DEMO MODE — ?demo=1 заливает данные с реальной бумажки
   (Стас, Денис, Леха, ВАВА, Макс — все 15 партий)
   ============================================================ */
function loadDemo() {
  state = {
    players: ['Стас', 'Денис', 'Леха', 'ВАВА', 'Макс'],
    results: [
      { a: 5,  b: 11 },  // 1
      { a: 11, b: 8  },  // 2
      { a: 11, b: 5  },  // 3
      { a: 6,  b: 11 },  // 4
      { a: 11, b: 10 },  // 5
      { a: 9,  b: 11 },  // 6
      { a: 10, b: 11 },  // 7
      { a: 11, b: 10 },  // 8
      { a: 9,  b: 11 },  // 9
      { a: 11, b: 10 },  // 10
      { a: 10, b: 11 },  // 11
      { a: 8,  b: 11 },  // 12
      { a: 8,  b: 11 },  // 13
      { a: 11, b: 4  },  // 14
      { a: 11, b: 7  },  // 15
    ],
    phase: 'done'
  };
  save();
}

function init() {
  // ?demo=1 — заливаем демо-данные перед обычной загрузкой
  if (new URLSearchParams(location.search).has('demo')) {
    loadDemo();
  } else {
    load();
  }

  // Подвязать обработчики
  $('#setup-form').addEventListener('submit', onSetupSubmit);
  $('#save-btn').addEventListener('click', onSaveMatch);
  $('#undo-btn').addEventListener('click', onUndo);
  $('#reset-btn').addEventListener('click', onReset);
  $('#restart-btn').addEventListener('click', onReset);

  // Делегированные обработчики для редактирования истории —
  // подключаем к обоим спискам (game-view и done-view)
  document.querySelectorAll('#history-list-game, #history-list-done').forEach(list => {
    list.addEventListener('click', onHistoryClick);
    list.addEventListener('keydown', onHistoryKeydown);
  });

  // Enter в поле счёта = сохранить
  ['#score-a', '#score-b'].forEach(sel => {
    $(sel).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSaveMatch();
      }
    });
  });

  // Стартовый экран по состоянию
  if (state.phase === 'game' && state.players.every(n => n)) {
    showView('game');
    renderGame();
  } else if (state.phase === 'done') {
    showView('done');
    renderDone();
  } else {
    showView('setup');
    renderSetup();
  }
}

document.addEventListener('DOMContentLoaded', init);
