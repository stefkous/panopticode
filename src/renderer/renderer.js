const STATE_LABELS = {
  working: 'Working',
  waiting: 'Waiting for you',
  idle: 'Idle',
  errored: 'Error',
};

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const listEl = document.getElementById('session-list');
const terminalsEl = document.getElementById('terminals');
const emptyEl = document.getElementById('empty');
const todosTab = document.getElementById('todos-tab');
const todosView = document.getElementById('todos-view');
const terms = new Map();
let sessions = [];
let selectedId = null;
let view = 'terminal';
let renaming = null;

function termTheme() {
  return darkQuery.matches
    ? { background: '#1b1b1f', foreground: '#ebeae6', cursor: '#ebeae6', selectionBackground: '#44444c' }
    : {
        background: '#fafaf9',
        foreground: '#1c1b19',
        cursor: '#1c1b19',
        selectionBackground: '#d6d3cc',
        // Claude's code-word colour (#afd7ff) is too pale on a light background.
        extendedAnsi: extendedPalette({ 153: '#1f5fbf' }),
      };
}

function shortenPath(p) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

function renderList() {
  // Pause redraws while a name is being edited, so the edit box is not replaced mid-typing.
  if (renaming && listEl.querySelector('.rename')) return;
  const selected = view === 'terminal' && sessions.find((s) => s.id === selectedId);
  document.title =
    view === 'todos'
      ? 'Today’s TODOs'
      : selected
        ? `${selected.name} — ${shortenPath(selected.cwd)}`
        : 'Panopticode';
  todosTab.classList.toggle('selected', view === 'todos');
  document.getElementById('sessions-count').textContent = sessions.length ? String(sessions.length) : '';
  const bar = document.getElementById('term-bar');
  bar.hidden = !selected;
  if (selected) {
    bar.className = selected.state;
    document.getElementById('term-name').textContent = selected.name;
    document.getElementById('term-cwd').textContent = shortenPath(selected.cwd);
  }
  listEl.replaceChildren(
    ...groupByStatus(sessions).flatMap((section) => {
      const folded = collapsed.has(section.state);
      return [
        sectionHeader(section, folded),
        ...(folded ? [] : section.sessions.map(({ session, index }) => sessionRow(session, index, selected))),
      ];
    }),
  );
  emptyEl.hidden = sessions.length > 0 || view === 'todos';
}

const COLLAPSED_KEY = 'collapsedSections';
const collapsed = new Set(readCollapsed());

// localStorage can be unavailable; folding then just isn't remembered.
function readCollapsed() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
  } catch (e) {
    if (e instanceof DOMException || e instanceof SyntaxError) return [];
    throw e;
  }
}

function toggleSection(state) {
  if (!collapsed.delete(state)) collapsed.add(state);
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch (e) {
    if (!(e instanceof DOMException)) throw e;
  }
  renderList();
}

function sectionHeader(section, folded) {
  const li = document.createElement('li');
  li.className = `section-header ${section.state}`;
  li.innerHTML = '<span class="caret"></span><span class="label"></span><span class="count"></span>';
  li.querySelector('.caret').textContent = folded ? '▸' : '▾';
  li.querySelector('.label').textContent = section.label;
  li.querySelector('.count').textContent = String(section.sessions.length);
  li.addEventListener('click', () => toggleSection(section.state));
  return li;
}

function sessionRow(s, index, selected) {
  const li = document.createElement('li');
  li.className = `session ${s.state}${selected?.id === s.id ? ' selected' : ''}`;
  li.title = s.cwd;
  li.innerHTML = `
    <span class="dot"></span>
    <span class="name"></span>
    <span class="shortcut">${index < 9 ? `⌘${index + 1}` : ''}</span>
    <span class="cwd"></span>`;
  li.querySelector('.name').textContent = s.name;
  if (renaming?.id === s.id) li.querySelector('.name').replaceWith(renameInput(s));
  li.querySelector('.cwd').textContent = shortenPath(s.cwd);
  li.addEventListener('click', () => renaming?.id !== s.id && select(s.id));
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.deck.showSessionMenu(s.id);
  });
  return li;
}

function renameInput(session) {
  const input = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'rename',
    value: session.name,
    placeholder: 'Leave empty to use Claude’s title',
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.deck.rename(session.id, input.value);
    if (e.key === 'Enter' || e.key === 'Escape') {
      renaming = null;
      renderList();
    }
  });
  input.addEventListener('blur', () => {
    if (!renaming) return;
    renaming = null;
    renderList();
  });
  requestAnimationFrame(() => input.select());
  return input;
}

window.deck.onRenameRequest((id) => {
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  renaming = { id };
  renderList();
});

function createTerm(id) {
  const el = document.createElement('div');
  el.className = 'term';
  terminalsEl.append(el);
  const term = new Terminal({
    fontFamily: '"SF Mono", Menlo, Monaco, monospace',
    fontSize: 13,
    theme: termTheme(),
    macOptionIsMeta: true,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(el);
  term.onData((data) => window.deck.input(id, data));
  term.onResize(({ cols, rows }) => window.deck.resize(id, cols, rows));
  const entry = { el, term, fit };
  terms.set(id, entry);
  el.classList.add('visible');
  fit.fit();
  window.deck.attach(id, term.cols, term.rows);
  return entry;
}

function select(id) {
  selectedId = id;
  view = 'terminal';
  todosView.hidden = true;
  for (const [termId, entry] of terms) entry.el.classList.toggle('visible', termId === id);
  const entry = terms.get(id) ?? createTerm(id);
  entry.el.classList.add('visible');
  entry.fit.fit();
  entry.term.focus();
  renderList();
}

function dropTerm(id) {
  terms.get(id)?.term.dispose();
  terms.get(id)?.el.remove();
  terms.delete(id);
}

window.deck.onSessions((next) => {
  sessions = next;
  const ids = new Set(sessions.map((s) => s.id));
  for (const id of terms.keys()) if (!ids.has(id)) dropTerm(id);
  if (!ids.has(selectedId)) {
    selectedId = null;
    if (sessions.length && view === 'terminal') select(sessions[0].id);
  }
  renderList();
  renderTopTodos();
  if (view === 'todos') renderTodos();
});

window.deck.onData((id, data) => terms.get(id)?.term.write(data));
window.deck.onExit((id) => dropTerm(id));
window.deck.onSelectIndex((i) => sessions[i] && select(sessions[i].id));

async function newSession() {
  const id = await window.deck.newSession();
  if (id) select(id);
}

document.getElementById('new-session').addEventListener('click', newSession);
window.deck.onRequestNewSession(newSession);

new ResizeObserver(() => selectedId && terms.get(selectedId)?.fit.fit()).observe(terminalsEl);

darkQuery.addEventListener('change', () => {
  for (const { term } of terms.values()) term.options.theme = termTheme();
});

const EXTERNAL_STATUS = { busy: 'Working', waiting: 'Waiting for you', idle: 'Idle' };
const importPanel = document.getElementById('import-panel');
const externalList = document.getElementById('external-list');

async function showImport() {
  importPanel.hidden = false;
  externalList.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Loading…' }));
  const external = await window.deck.listExternal();
  if (!external.length) {
    externalList.replaceChildren(
      Object.assign(document.createElement('li'), { textContent: 'No sessions running outside this app.' }),
    );
    return;
  }
  externalList.replaceChildren(
    ...external.map((s) => {
      const li = document.createElement('li');
      li.className = 'external';
      li.innerHTML = '<span class="name"></span><span class="cwd"></span><span class="meta"></span><button></button>';
      li.querySelector('.name').textContent = s.name;
      li.querySelector('.cwd').textContent = shortenPath(s.cwd);
      li.querySelector('.meta').textContent = `In ${s.source} · ${EXTERNAL_STATUS[s.status] ?? s.status}`;
      const button = li.querySelector('button');
      button.textContent = s.status === 'busy' ? 'Working…' : 'Import';
      button.disabled = s.status === 'busy';
      button.title = s.status === 'busy' ? 'Wait until Claude has finished in this session' : '';
      button.addEventListener('click', async () => {
        const id = await window.deck.importSession(s.pid);
        if (!id) return showImport();
        importPanel.hidden = true;
        select(id);
      });
      return li;
    }),
  );
}

document.getElementById('import').addEventListener('click', showImport);
document.getElementById('import-close').addEventListener('click', () => {
  importPanel.hidden = true;
});
window.deck.onRequestImport(showImport);

// Today's TODOs

const todoList = document.getElementById('todo-list');
const notesEl = document.getElementById('todo-notes');
const todosCount = document.getElementById('todos-count');
let day = null;
let saveTimer = null;

function saveNow() {
  clearTimeout(saveTimer);
  window.deck.saveTodos(day);
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function updateCount() {
  const open = day ? day.items.filter((i) => !i.done && i.text.trim()).length : 0;
  todosCount.textContent = open ? String(open) : '';
  renderTopTodos();
}

function urgencyClass(urgency) {
  if (urgency >= 4) return 'urgency high';
  if (urgency === 3) return 'urgency medium';
  return 'urgency low';
}

function renderTopTodos() {
  if (!day) return;
  document.getElementById('top-todos').replaceChildren(
    ...topTodos(day.items, 5).map((item) => {
      const li = document.createElement('li');
      const session = sessions.find((s) => s.id === item.sessionId);
      li.className = `top-todo ${session?.state ?? ''}`;
      li.innerHTML = '<span class="badge"></span><span class="top-text"></span><span class="dot"></span>';
      const badge = li.querySelector('.badge');
      badge.textContent = item.urgency ?? '';
      badge.className = item.urgency ? urgencyClass(item.urgency) : 'badge';
      li.querySelector('.top-text').textContent = item.text;
      li.title = session ? `${item.text} — open ${session.name}` : item.text;
      li.addEventListener('click', () => (session ? select(session.id) : showTodos()));
      return li;
    }),
  );
}

function urgencyPicker(item) {
  const picker = document.createElement('select');
  picker.className = 'urgency-picker';
  picker.title = 'Urgency (5 = most urgent)';
  for (const [value, label] of [['', '–'], ...[5, 4, 3, 2, 1].map((n) => [String(n), String(n)])]) {
    picker.append(new Option(label, value));
  }
  picker.value = item.urgency ? String(item.urgency) : '';
  picker.addEventListener('change', () => {
    item.urgency = picker.value ? Number(picker.value) : null;
    saveNow();
    renderTodos();
  });
  return picker;
}

function sessionLink(item) {
  if (!item.sessionId) return document.createElement('span');
  const session = sessions.find((s) => s.id === item.sessionId);
  if (!session) {
    return Object.assign(document.createElement('span'), {
      className: 'closed',
      textContent: 'Session closed',
    });
  }
  const chip = document.createElement('button');
  chip.className = `chip ${session.state}`;
  chip.title = `Open ${session.name}`;
  chip.innerHTML = '<span class="dot"></span><span class="chip-name"></span><span class="state"></span>';
  chip.querySelector('.chip-name').textContent = session.name;
  chip.querySelector('.state').textContent = STATE_LABELS[session.state] ?? session.state;
  chip.addEventListener('click', () => select(session.id));
  return chip;
}

function sessionPicker(item) {
  const picker = document.createElement('select');
  const options = [['', 'No session'], ...sessions.map((s) => [s.id, s.name])];
  if (item.sessionId && !sessions.some((s) => s.id === item.sessionId)) {
    options.push([item.sessionId, 'Closed session']);
  }
  for (const [value, label] of options) picker.append(new Option(label, value));
  picker.value = item.sessionId ?? '';
  picker.title = 'Link to a session';
  picker.addEventListener('change', () => {
    item.sessionId = picker.value || null;
    saveNow();
    renderTodos();
  });
  return picker;
}

// A Done TODO whose session was closed on tick can bring the conversation back.
function linkOrReopen(item) {
  const reopenable =
    item.done && item.closedSession?.claudeSessionId && !sessions.some((s) => s.id === item.sessionId);
  if (!reopenable) return sessionLink(item);
  const button = Object.assign(document.createElement('button'), {
    textContent: `Reopen “${item.closedSession.name}”`,
    title: 'Resume this conversation in the app',
  });
  button.addEventListener('click', async () => {
    const id = await window.deck.reopenForTodo(item.id, item.closedSession);
    delete item.closedSession;
    Object.assign(item, { done: false, sessionId: id });
    saveNow();
    select(id);
  });
  return button;
}

function todoRow(item) {
  const li = document.createElement('li');
  li.className = `todo${item.done ? ' done' : ''}`;

  const tick = Object.assign(document.createElement('input'), { type: 'checkbox', checked: item.done });
  tick.addEventListener('change', async () => {
    item.done = tick.checked;
    saveNow();
    renderTodos();
    const running = item.done && sessions.some((s) => s.id === item.sessionId);
    if (!running) return;
    const closed = await window.deck.closeForTodo(item.sessionId);
    if (!closed) return;
    item.closedSession = closed;
    saveNow();
    renderTodos();
  });

  const text = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'todo-text',
    value: item.text,
    placeholder: item.sessionId ? 'What’s the goal for this session?' : 'Something to do',
  });
  text.dataset.focusKey = item.id;
  text.addEventListener('input', () => {
    item.text = text.value;
    updateCount();
    saveSoon();
  });

  const remove = Object.assign(document.createElement('button'), {
    className: 'delete',
    textContent: '×',
    title: 'Delete',
  });
  remove.addEventListener('click', () => {
    day.items = day.items.filter((i) => i !== item);
    saveNow();
    renderTodos();
  });

  li.append(tick, urgencyPicker(item), text, sessionPicker(item), linkOrReopen(item), remove);
  return li;
}

function renderTodos() {
  if (!day) return;
  const focusKey = document.activeElement?.dataset?.focusKey;
  const caret = document.activeElement?.selectionStart;
  todoList.replaceChildren(...day.items.filter((i) => !i.done).map(todoRow));
  const done = day.items.filter((i) => i.done);
  document.getElementById('done-list').replaceChildren(...done.map(todoRow));
  document.getElementById('done-section').hidden = !done.length;
  if (focusKey) {
    const input = todosView.querySelector(`[data-focus-key="${focusKey}"]`);
    input?.focus();
    input?.setSelectionRange(caret, caret);
  }
  if (document.activeElement !== notesEl) notesEl.value = day.notes;
  document.getElementById('todos-date').textContent = new Date(`${day.key}T00:00`).toLocaleDateString(
    'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' },
  );
  updateCount();
}

function showTodos() {
  view = 'todos';
  for (const entry of terms.values()) entry.el.classList.remove('visible');
  importPanel.hidden = true;
  todosView.hidden = false;
  renderTodos();
  renderList();
}

window.deck.onTodos((incoming) => {
  if (!day || day.key !== incoming.key) {
    day = incoming;
  } else {
    const known = new Set(day.items.map((i) => i.id));
    day.items.push(...incoming.items.filter((i) => !known.has(i.id)));
  }
  if (view === 'todos') renderTodos();
  updateCount();
});

todosTab.addEventListener('click', showTodos);
notesEl.addEventListener('input', () => {
  day.notes = notesEl.value;
  saveSoon();
});
document.getElementById('todo-add').addEventListener('click', () => {
  const item = { id: crypto.randomUUID(), text: '', done: false, sessionId: null, urgency: null };
  day.items.push(item);
  saveNow();
  renderTodos();
  todoList.querySelector(`[data-focus-key="${item.id}"]`).focus();
});
window.deck.getTodos().then((loaded) => {
  day = loaded;
  updateCount();
});

// Appearance switch

const appearanceButtons = document.querySelectorAll('#appearance button');

function markAppearance(theme) {
  for (const button of appearanceButtons) {
    button.classList.toggle('active', button.dataset.theme === theme);
  }
}

for (const button of appearanceButtons) {
  button.addEventListener('click', () => window.deck.setAppearance(button.dataset.theme));
}
window.deck.onAppearance(markAppearance);
window.deck.getAppearance().then(markAppearance);

// Colours panel

const coloursPanel = document.getElementById('colours-panel');
const todoColourPicker = document.getElementById('todo-colour');
const sessionColourPicker = document.getElementById('session-colour');

function applyColours({ todo, session }) {
  document.documentElement.style.setProperty('--todo-base', todo);
  document.documentElement.style.setProperty('--session-base', session);
  todoColourPicker.value = todo;
  sessionColourPicker.value = session;
}

function chooseColours(colours) {
  applyColours(colours);
  window.deck.setColours(colours);
}

document.getElementById('presets').replaceChildren(
  ...PRESETS.map((preset) => {
    const button = document.createElement('button');
    button.className = 'preset';
    button.innerHTML = '<span class="swatch"></span><span class="swatch"></span><span></span>';
    const [todoSwatch, sessionSwatch, label] = button.children;
    todoSwatch.style.background = preset.todo;
    sessionSwatch.style.background = preset.session;
    label.textContent = preset.name;
    button.addEventListener('click', () => chooseColours({ todo: preset.todo, session: preset.session }));
    return button;
  }),
);

for (const picker of [todoColourPicker, sessionColourPicker]) {
  picker.addEventListener('input', () => applyColours({ todo: todoColourPicker.value, session: sessionColourPicker.value }));
  picker.addEventListener('change', () => chooseColours({ todo: todoColourPicker.value, session: sessionColourPicker.value }));
}

document.getElementById('colours-open').addEventListener('click', () => {
  coloursPanel.hidden = false;
});
document.getElementById('colours-close').addEventListener('click', () => {
  coloursPanel.hidden = true;
});
window.deck.getColours().then(applyColours);
