// ===== Справочник PHOTO LAB: страницы, поиск и вход =====

const DEMO_PASSWORD = 'photolab'; // В рабочей версии доступ закрывается паролем на стороне хостинга
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

const roleById = Object.fromEntries(ROLES.map(r => [r.id, r]));
let docs = DOCS; // сначала – встроенная копия, потом тексты из Google-таблицы
let docById = Object.fromEntries(docs.map(d => [d.id, d]));

// ---------- Вспомогательные функции ----------

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
}

function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function storageGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, value) { try { sessionStorage.setItem(key, value); } catch (e) {} }
function storageRemove(key) { try { sessionStorage.removeItem(key); } catch (e) {} }

// ---------- Поиск ----------

function norm(text) { return String(text).toLowerCase().replace(/ё/g, 'е'); }

// Отрезаем окончание, чтобы «перерывы» находили «перерыв», а «брак» – «брака»
function stemsOf(query) {
  return norm(query).split(/[^а-яa-z0-9]+/).filter(w => w.length >= 2)
    .map(w => (w.length > 5 ? w.slice(0, -2) : w));
}

function bodyText(doc) {
  return doc.body.map(b => (b.items ? b.items.join(' ') : b.text)).join(' ');
}

function search(query) {
  const stems = stemsOf(query);
  if (!stems.length) return [];
  return docs.map(doc => {
    const title = norm(doc.title), tags = norm(doc.tags.join(' ')), summary = norm(doc.summary), body = norm(bodyText(doc));
    let score = 0;
    for (const s of stems) {
      const hit = (title.includes(s) ? 6 : 0) + (tags.includes(s) ? 4 : 0) + (summary.includes(s) ? 2 : 0) + (body.includes(s) ? 1 : 0);
      if (!hit) return null; // все слова запроса должны найтись
      score += hit;
    }
    return { doc, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(r => r.doc);
}

function highlight(text, stems) {
  let html = esc(text);
  if (!stems.length) return html;
  const pattern = new RegExp('(' + stems.map(s => s.replace(/е/g, '[её]')).join('|') + ')', 'gi');
  return html.replace(pattern, '<mark>$1</mark>');
}

// Кусочек текста, где нашлось слово
function snippet(doc, stems) {
  const parts = doc.body.flatMap(b => (b.items ? b.items : [b.text]));
  const found = parts.find(p => stems.some(s => norm(p).includes(s)));
  return found || doc.summary;
}

// ---------- Общие кусочки разметки ----------

function roleChip(role) {
  return '<span class="chip" style="--role:' + role.color + '">' + esc(role.name) + '</span>';
}

function docLink(doc, stems) {
  const role = roleById[doc.role];
  const text = stems ? snippet(doc, stems) : doc.summary;
  return '<a class="doc-link" href="#/doc/' + doc.id + '" style="--role:' + role.color + '">' +
    '<span class="doc-link-title">' + (stems ? highlight(doc.title, stems) : esc(doc.title)) + '</span>' +
    '<span class="doc-link-text">' + (stems ? highlight(text, stems) : esc(text)) + '</span>' +
    '<span class="doc-link-meta">' + esc(role.name) + ', ' + esc(doc.group) + '</span>' +
    '</a>';
}

// ---------- Страницы ----------

function renderGate(error) {
  topbar.hidden = true;
  app.innerHTML =
    '<section class="gate">' +
      '<svg class="gate-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 2v28M2 16h28" stroke="currentColor" stroke-width="2"/></svg>' +
      '<h1>Вход для сотрудников</h1>' +
      '<p class="gate-lead">Корпоративная книга PHOTO LAB: регламенты для всех ролей.</p>' +
      '<form class="gate-form" id="gate-form">' +
        '<label for="gate-password">Пароль</label>' +
        '<input id="gate-password" type="password" autocomplete="current-password" required>' +
        (error ? '<p class="gate-error" role="alert">Пароль не подошёл. Проверьте раскладку и попробуйте ещё раз.</p>' : '') +
        '<button class="btn" type="submit">Войти</button>' +
      '</form>' +
      '<p class="gate-hint">Пароль для демо: <strong>' + DEMO_PASSWORD + '</strong></p>' +
    '</section>';
  const input = document.getElementById('gate-password');
  input.focus();
  document.getElementById('gate-form').addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim().toLowerCase() === DEMO_PASSWORD) {
      storageSet('pl-auth', '1');
      route();
    } else {
      renderGate(true);
    }
  });
}

function renderHome(query) {
  const recent = [...docs].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4);
  app.innerHTML =
    '<section class="home-search">' +
      '<h1>Найдите правило за пару секунд</h1>' +
      '<form class="big-search" id="big-search" role="search">' +
        '<input type="search" id="big-input" placeholder="Например: брак или касса" aria-label="Поиск по регламентам" autocomplete="off">' +
      '</form>' +
      '<div class="hints">' + SEARCH_HINTS.map(h => '<button type="button" class="hint">' + esc(h) + '</button>').join('') + '</div>' +
    '</section>' +
    '<section class="results" id="results" aria-live="polite"></section>' +
    '<div id="home-browse">' +
      '<section class="block">' +
        '<h2>Регламенты по ролям</h2>' +
        '<div class="roles">' +
          ROLES.map(role => {
            const count = docs.filter(d => d.role === role.id).length;
            return '<a class="role-tab" href="#/role/' + role.id + '" style="--role:' + role.color + '">' +
              '<span class="role-name">' + esc(role.name) + '</span>' +
              '<span class="role-desc">' + esc(role.desc) + '</span>' +
              '<span class="role-count">' + count + ' ' + plural(count, 'регламент', 'регламента', 'регламентов') + '</span>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<section class="block">' +
        '<h2>Недавно обновлены</h2>' +
        '<div class="doc-list">' + recent.map(d => docLink(d)).join('') + '</div>' +
      '</section>' +
    '</div>';

  const input = document.getElementById('big-input');
  const results = document.getElementById('results');
  const browse = document.getElementById('home-browse');

  function showResults() {
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; browse.hidden = false; return; }
    const found = search(q);
    browse.hidden = true;
    const stems = stemsOf(q);
    results.innerHTML = found.length
      ? '<p class="results-count">' + found.length + ' ' + plural(found.length, 'регламент', 'регламента', 'регламентов') + ' по запросу «' + esc(q) + '»</p>' +
        '<div class="doc-list">' + found.map(d => docLink(d, stems)).join('') + '</div>'
      : '<div class="empty"><p>По запросу «' + esc(q) + '» ничего не нашлось.</p>' +
        '<p>Попробуйте другое слово – например, «касса» или «съёмка» – или откройте раздел своей роли.</p>' +
        '<button type="button" class="btn btn-ghost" id="clear-search">Показать все роли</button></div>';
    const clear = document.getElementById('clear-search');
    if (clear) clear.addEventListener('click', () => { input.value = ''; showResults(); input.focus(); });
  }

  input.addEventListener('input', showResults);
  document.getElementById('big-search').addEventListener('submit', e => { e.preventDefault(); input.blur(); });
  document.querySelectorAll('.hint').forEach(btn => btn.addEventListener('click', () => {
    input.value = btn.textContent; showResults();
  }));

  if (query) { input.value = query; showResults(); }
  else if (window.matchMedia('(min-width: 700px)').matches) input.focus();
}

function renderRole(id) {
  const role = roleById[id];
  if (!role) return renderNotFound();
  const roleDocs = docs.filter(d => d.role === id);
  const groups = [...new Set(roleDocs.map(d => d.group))];
  app.innerHTML =
    '<nav class="crumbs" aria-label="Путь"><a href="#/">Главная</a><span aria-hidden="true">/</span><span>' + esc(role.name) + '</span></nav>' +
    '<section class="role-head" style="--role:' + role.color + '">' +
      '<h1>' + esc(role.name) + '</h1>' +
      '<p>' + esc(role.desc) + '</p>' +
    '</section>' +
    groups.map(g =>
      '<section class="block">' +
        '<h2>' + esc(g) + '</h2>' +
        '<div class="doc-list">' + roleDocs.filter(d => d.group === g).map(d => docLink(d)).join('') + '</div>' +
      '</section>'
    ).join('') +
    (id !== 'all' ? '<p class="also">Не забудьте про общие правила: <a href="#/role/all">регламенты для всех сотрудников</a>.</p>' : '');
}

function renderBlock(b) {
  if (b.type === 'p') return '<p>' + esc(b.text) + '</p>';
  if (b.type === 'note') return '<aside class="note"><strong>Важно.</strong> ' + esc(b.text) + '</aside>';
  if (b.type === 'steps') return '<ol class="steps">' + b.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>';
  if (b.type === 'list') return '<ul class="bullets">' + b.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
  return '';
}

function renderDoc(id) {
  const doc = docById[id];
  if (!doc) return renderNotFound();
  const role = roleById[doc.role];
  const related = (doc.related || []).map(r => docById[r]).filter(Boolean);
  app.innerHTML =
    '<nav class="crumbs" aria-label="Путь"><a href="#/">Главная</a><span aria-hidden="true">/</span>' +
      '<a href="#/role/' + role.id + '">' + esc(role.name) + '</a><span aria-hidden="true">/</span><span>' + esc(doc.group) + '</span></nav>' +
    '<article class="doc" style="--role:' + role.color + '">' +
      '<h1>' + esc(doc.title) + '</h1>' +
      '<p class="doc-meta">' + roleChip(role) + '<span>Обновлено ' + formatDate(doc.updated) + '</span></p>' +
      '<p class="doc-summary">' + esc(doc.summary) + '</p>' +
      doc.body.map(renderBlock).join('') +
    '</article>' +
    (related.length
      ? '<section class="block"><h2>Связанные регламенты</h2><div class="doc-list">' + related.map(d => docLink(d)).join('') + '</div></section>'
      : '');
}

function renderNotFound() {
  app.innerHTML =
    '<section class="empty empty-page"><h1>Такой страницы нет</h1>' +
    '<p>Возможно, регламент переименовали. Найдите его через поиск на главной.</p>' +
    '<a class="btn" href="#/">На главную</a></section>';
}

// ---------- Переходы между страницами ----------

// refresh = true – перерисовать текущую страницу новыми текстами, не сбивая прокрутку и поиск
function route(refresh) {
  const isRefresh = refresh === true;
  if (storageGet('pl-auth') !== '1') return renderGate(false);
  topbar.hidden = false;
  sourceLine.hidden = false;

  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, queryString] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  let q = new URLSearchParams(queryString || '').get('q') || '';

  // При обновлении главной сохраняем то, что человек уже набрал в поиске
  const typed = document.getElementById('big-input');
  const hadFocus = typed && document.activeElement === typed;
  if (isRefresh && typed) q = typed.value;

  document.body.classList.toggle('is-home', !parts.length);
  if (!parts.length) renderHome(q);
  else if (parts[0] === 'role') renderRole(parts[1]);
  else if (parts[0] === 'doc') renderDoc(parts[1]);
  else renderNotFound();

  if (isRefresh) {
    if (hadFocus) document.getElementById('big-input').focus();
    return;
  }
  window.scrollTo(0, 0);
  if (parts.length) app.focus({ preventScroll: true });
}

// ---------- Тексты из Google-таблицы ----------
// HR правит таблицу – сайт при открытии берёт свежие тексты.
// Таблица открыта только для чтения по ссылке.

const SHEET_ID = '1qw5DY_NkLGvDvOVhVqx-Ag2V8QboVPkc_lFqE0SiKN0';
const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=csv&gid=0';
const CACHE_KEY = 'pl-docs';
const sourceLine = document.getElementById('source');

function setSource(text) { sourceLine.textContent = text; }

function timeNow() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Разбор CSV: учитываем кавычки и переносы строк внутри ячеек
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Текст из ячейки → блоки регламента:
// «1. …» – шаги, «- …» – список, «Важно: …» – выделенный блок, остальное – абзацы
function textToBody(text) {
  const body = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const last = body[body.length - 1];
    let m;
    if ((m = line.match(/^\d+[.)]\s*(.+)$/))) {
      if (last && last.type === 'steps' && !/^1[.)]/.test(line)) last.items.push(m[1]);
      else body.push({ type: 'steps', items: [m[1]] });
    } else if ((m = line.match(/^[-–•]\s*(.+)$/))) {
      if (last && last.type === 'list') last.items.push(m[1]);
      else body.push({ type: 'list', items: [m[1]] });
    } else if ((m = line.match(/^важно[:.!]\s*(.+)$/i))) {
      body.push({ type: 'note', text: m[1] });
    } else {
      body.push({ type: 'p', text: line });
    }
  }
  return body;
}

function toIsoDate(value) {
  const v = String(value).trim();
  let m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? v : '2026-01-01';
}

function rowsToDocs(rows) {
  const head = rows[0].map(h => norm(h.trim()));
  const col = name => head.indexOf(norm(name));
  const c = {
    id: col('Код'), role: col('Роль'), group: col('Раздел'), title: col('Название'), summary: col('Кратко'),
    text: col('Текст'), tags: col('Слова для поиска'), updated: col('Обновлено'), related: col('Связанные')
  };
  if (c.title < 0 || c.text < 0) return [];
  const roleByName = Object.fromEntries(ROLES.map(r => [norm(r.name), r.id]));
  const get = (row, i) => (i >= 0 && row[i] ? row[i].trim() : '');

  const list = rows.slice(1).filter(row => get(row, c.title)).map((row, n) => ({
    id: (get(row, c.id) || 'r' + (n + 1)).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    role: roleByName[norm(get(row, c.role))] || 'all',
    group: get(row, c.group) || 'Общее',
    title: get(row, c.title),
    summary: get(row, c.summary),
    body: textToBody(get(row, c.text)),
    tags: get(row, c.tags).split(',').map(t => t.trim()).filter(Boolean),
    updated: toIsoDate(get(row, c.updated)),
    relatedTitles: get(row, c.related).split(';').map(t => norm(t.trim())).filter(Boolean)
  }));
  // «Связанные» в таблице пишутся названиями – превращаем их в ссылки
  const idByTitle = Object.fromEntries(list.map(d => [norm(d.title), d.id]));
  list.forEach(d => { d.related = d.relatedTitles.map(t => idByTitle[t]).filter(Boolean); delete d.relatedTitles; });
  return list;
}

function useDocs(list) {
  docs = list;
  docById = Object.fromEntries(docs.map(d => [d.id, d]));
}

async function loadFromSheet() {
  // Сначала показываем сохранённую копию с прошлого раза – это мгновенно
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.docs && cached.docs.length) useDocs(cached.docs);
  } catch (e) {}
  setSource('Загружаем свежие тексты из Google-таблицы…');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(SHEET_CSV, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const list = rowsToDocs(parseCSV(await response.text()));
    if (!list.length) throw new Error('в таблице нет регламентов');
    useDocs(list);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ docs: list, at: Date.now() })); } catch (e) {}
    setSource('Тексты загружены из Google-таблицы в ' + timeNow());
    if (storageGet('pl-auth') === '1') route(true); // экран входа не трогаем, чтобы не стереть набранный пароль
  } catch (e) {
    setSource('Нет связи с Google-таблицей – показана сохранённая копия регламентов.');
  }
}

document.getElementById('top-search').addEventListener('submit', e => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  e.target.q.value = '';
  location.hash = '#/?q=' + encodeURIComponent(q);
});

document.getElementById('logout').addEventListener('click', () => {
  storageRemove('pl-auth');
  sourceLine.hidden = true;
  location.hash = '#/';
  route();
});

window.addEventListener('hashchange', route);
loadFromSheet();
route();
