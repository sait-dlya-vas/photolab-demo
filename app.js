// ===== Справочник PHOTO LAB: страницы, поиск и вход =====

const DEMO_PASSWORD = 'photolab'; // В рабочей версии доступ закрывается паролем на стороне хостинга
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

const roleById = Object.fromEntries(ROLES.map(r => [r.id, r]));
const docById = Object.fromEntries(DOCS.map(d => [d.id, d]));

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
  return DOCS.map(doc => {
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
  const recent = [...DOCS].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4);
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
            const count = DOCS.filter(d => d.role === role.id).length;
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
  const docs = DOCS.filter(d => d.role === id);
  const groups = [...new Set(docs.map(d => d.group))];
  app.innerHTML =
    '<nav class="crumbs" aria-label="Путь"><a href="#/">Главная</a><span aria-hidden="true">/</span><span>' + esc(role.name) + '</span></nav>' +
    '<section class="role-head" style="--role:' + role.color + '">' +
      '<h1>' + esc(role.name) + '</h1>' +
      '<p>' + esc(role.desc) + '</p>' +
    '</section>' +
    groups.map(g =>
      '<section class="block">' +
        '<h2>' + esc(g) + '</h2>' +
        '<div class="doc-list">' + docs.filter(d => d.group === g).map(d => docLink(d)).join('') + '</div>' +
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

function route() {
  if (storageGet('pl-auth') !== '1') return renderGate(false);
  topbar.hidden = false;

  const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, queryString] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(queryString || '').get('q') || '';

  document.body.classList.toggle('is-home', !parts.length);
  if (!parts.length) renderHome(q);
  else if (parts[0] === 'role') renderRole(parts[1]);
  else if (parts[0] === 'doc') renderDoc(parts[1]);
  else renderNotFound();

  window.scrollTo(0, 0);
  if (parts.length) app.focus({ preventScroll: true });
}

document.getElementById('top-search').addEventListener('submit', e => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  e.target.q.value = '';
  location.hash = '#/?q=' + encodeURIComponent(q);
});

document.getElementById('logout').addEventListener('click', () => {
  storageRemove('pl-auth');
  location.hash = '#/';
  route();
});

window.addEventListener('hashchange', route);
route();
