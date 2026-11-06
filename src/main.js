const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme } = require('electron');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pty = require('node-pty');
const { externalSessions, parseProcTable } = require('./import');
const { SESSION_FORMAT, parseSessions } = require('./tmux-format');
const { dayKey, linkReopened, startDay, syncSessions } = require('./todos');
const { isAtPrompt, promptIsEmpty } = require('./rename');
const { PRESETS } = require('./colours');
const { migrate } = require('./migrate');

const SOCKET = 'panopticode';
const TMUX_CONF = path.join(__dirname, '..', 'tmux.conf');
const STATUS_DIR = path.join(os.homedir(), '.panopticode', 'status');
const TODO_DIR = path.join(os.homedir(), '.panopticode', 'todos');
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;
const NO_SERVER_EXIT_CODE = 1;

const ptys = new Map();
let win;
let lastSessionsJson = '';
let today = null;
const pendingRenames = new Map();

const PREFS_PATH = () => path.join(app.getPath('userData'), 'preferences.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

// Write then rename so a crash never leaves a half-written file.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

function setAppearance(theme) {
  nativeTheme.themeSource = theme;
  writeJson(PREFS_PATH(), { ...readJson(PREFS_PATH(), {}), theme });
  buildMenu();
  win?.webContents.send('appearance', theme);
}

/** Load a day's TODOs, starting it from the most recent earlier day if it has no file yet. */
function loadDay(key) {
  const saved = readJson(path.join(TODO_DIR, `${key}.json`), null);
  if (saved) return { key, ...saved };
  fs.mkdirSync(TODO_DIR, { recursive: true });
  const previousFile = fs
    .readdirSync(TODO_DIR)
    .filter((f) => DAY_FILE.test(f) && f < `${key}.json`)
    .sort()
    .at(-1);
  const previous = previousFile ? readJson(path.join(TODO_DIR, previousFile), null) : null;
  return { key, ...startDay(previous) };
}

function saveToday() {
  writeJson(path.join(TODO_DIR, `${today.key}.json`), { items: today.items, notes: today.notes });
}

/** Roll over at midnight and give every session a linked row; tell the window if anything changed. */
function refreshTodos(sessions) {
  const key = dayKey(new Date());
  const newDay = today?.key !== key;
  if (newDay) today = loadDay(key);
  const synced = syncSessions(today, sessions.map((s) => s.id), crypto.randomUUID);
  if (synced === today && !newDay) return;
  today = synced;
  saveToday();
  win?.webContents.send('todos', today);
}

function tmux(...args) {
  return execFileSync('tmux', ['-u', '-L', SOCKET, '-f', TMUX_CONF, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readState(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATUS_DIR, `${id}.json`), 'utf8')).state;
  } catch (e) {
    if (e.code === 'ENOENT') return 'idle';
    throw e;
  }
}

/** List the app's tmux sessions, oldest first, with their latest hook-reported state. */
function listSessions() {
  let out;
  try {
    out = tmux('list-sessions', '-F', SESSION_FORMAT);
  } catch (e) {
    if (e.status === NO_SERVER_EXIT_CODE) return [];
    throw e;
  }
  return parseSessions(out, os.hostname()).map((s) => ({ ...s, state: readState(s.id) }));
}

function pushSessions() {
  const list = listSessions();
  refreshTodos(list);
  const json = JSON.stringify(list);
  if (json === lastSessionsJson || !win) return;
  lastSessionsJson = json;
  const sessions = JSON.parse(json);
  const waiting = sessions.filter((s) => s.state === 'waiting').length;
  app.dock.setBadge(waiting ? String(waiting) : '');
  win.webContents.send('sessions', sessions);
}

/** Store the app name now; type `/rename` into Claude once it is safe (see tryPendingRenames). */
function renameSession(id, name) {
  const clean = name.replace(/[\x00-\x1f]/g, '').trim();
  if (clean) {
    tmux('set-option', '-t', id, '@deck_custom', clean);
    pendingRenames.set(id, clean);
  } else {
    tmux('set-option', '-u', '-t', id, '@deck_custom');
    pendingRenames.delete(id);
  }
  pushSessions();
}

// Typing into the terminal is only safe at an idle prompt with no draft, or it would mix with
// a permission dialog or text the user has started typing.
function tryPendingRenames() {
  for (const [id, name] of pendingRenames) {
    if (!isAtPrompt(readJson(path.join(STATUS_DIR, `${id}.json`), null))) continue;
    let screen;
    try {
      screen = tmux('capture-pane', '-e', '-p', '-t', id);
    } catch (e) {
      if (e.status !== NO_SERVER_EXIT_CODE) throw e;
      pendingRenames.delete(id);
      continue;
    }
    if (!promptIsEmpty(screen)) continue;
    tmux('send-keys', '-t', id, '-l', `/rename ${name}`);
    tmux('send-keys', '-t', id, 'Enter');
    pendingRenames.delete(id);
  }
}

/** Confirm, then quit Claude normally; its tmux session ends with it. History is kept. */
const newSessionId = () => `d${crypto.randomBytes(3).toString('hex')}`;

const workingWarning = (session) =>
  session.state === 'working' ? 'Claude is working right now; that work will stop. ' : '';

async function confirmClose(session, message, detail, keepLabel) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    message,
    detail: workingWarning(session) + detail,
    buttons: ['Close Session', keepLabel],
    defaultId: 0,
    cancelId: 1,
  });
  return response === 0;
}

/** Quit Claude in a session normally; its tmux session ends with it. Returns whether it exited. */
async function quitSession(id, pid) {
  process.kill(pid, 'SIGTERM');
  pendingRenames.delete(id);
  const exited = await waitForExit(pid, 10_000);
  if (!exited) {
    await dialog.showMessageBox(win, {
      type: 'error',
      message: 'The session did not close.',
      detail: `Claude (PID ${pid}) is still running. Type /exit in it and try again.`,
    });
  }
  pushSessions();
  return exited;
}

const panePid = (id) => Number(tmux('display-message', '-p', '-t', id, '#{pane_pid}').trim());

async function closeSession(id) {
  const session = listSessions().find((s) => s.id === id);
  if (!session) return;
  const confirmed = await confirmClose(
    session,
    `Close “${session.name}”?`,
    'The conversation is kept and can be reopened with claude --resume.',
    'Cancel',
  );
  if (confirmed) await quitSession(id, panePid(id));
}

/**
 * After a linked TODO is ticked: offer to close its session. Returns what is needed to reopen
 * it later ({ claudeSessionId, cwd, name }), or null if it was kept running or did not close.
 */
async function closeForTodo(id) {
  const session = listSessions().find((s) => s.id === id);
  if (!session) return null;
  const confirmed = await confirmClose(
    session,
    `Also close “${session.name}”?`,
    'The conversation is kept; you can reopen it from Done.',
    'Keep Running',
  );
  if (!confirmed) return null;
  const pid = panePid(id);
  const agents = JSON.parse(execFileSync('claude', ['agents', '--json'], { encoding: 'utf8' }));
  const claudeSessionId = agents.find((a) => a.pid === pid)?.sessionId ?? null;
  if (!(await quitSession(id, pid))) return null;
  return { claudeSessionId, cwd: session.cwd, name: session.name };
}

/** Resume a Done TODO's closed session and link it back, before the session list refreshes. */
function reopenForTodo(itemId, { claudeSessionId, cwd, name }) {
  const id = newSessionId();
  today = linkReopened(today, itemId, id);
  saveToday();
  return startSession(cwd, name, ['claude', '--resume', claudeSessionId], id);
}

async function newSession() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose a folder for the new session',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled) return null;
  return startSession(filePaths[0], path.basename(filePaths[0]), ['claude']);
}

function startSession(cwd, name, command, id = newSessionId()) {
  tmux('new-session', '-d', '-s', id, '-c', cwd, '-e', `PANOPTICODE_ID=${id}`, ...command);
  tmux('set-option', '-t', id, '@deck_name', name);
  pushSessions();
  return id;
}

function deckPanePids() {
  try {
    return new Set(tmux('list-panes', '-a', '-F', '#{pane_pid}').trim().split('\n').map(Number));
  } catch (e) {
    if (e.status === NO_SERVER_EXIT_CODE) return new Set();
    throw e;
  }
}

/** Running interactive Claude sessions outside the app (e.g. in iTerm2) that can be imported. */
function listExternal() {
  const agents = JSON.parse(execFileSync('claude', ['agents', '--json'], { encoding: 'utf8' }));
  const ps = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,comm='], { encoding: 'utf8' });
  return externalSessions(agents, deckPanePids(), parseProcTable(ps));
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e.code === 'ESRCH') return false;
    throw e;
  }
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  return !isAlive(pid);
}

/**
 * Reopen an external session in the app: confirm, close the original process, then resume the
 * conversation here. Two live processes on one session would write to the same transcript.
 */
async function importSession(pid) {
  const session = listExternal().find((s) => s.pid === pid);
  if (!session) {
    await dialog.showMessageBox(win, { message: 'That session is no longer running.' });
    return null;
  }
  if (session.status === 'busy') {
    await dialog.showMessageBox(win, {
      message: `Claude is working in “${session.name}” right now.`,
      detail: 'Import it once it has finished, so no work is interrupted.',
    });
    return null;
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    message: `Import “${session.name}”?`,
    detail:
      `The original session in ${session.source} (PID ${pid}) will be closed, then the ` +
      `conversation reopens here with its full history. The ${session.source} window stays ` +
      'open at a shell prompt.',
    buttons: ['Close original and import', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return null;

  process.kill(pid, 'SIGTERM');
  if (!(await waitForExit(pid, 10_000))) {
    await dialog.showMessageBox(win, {
      type: 'error',
      message: 'The original session did not close.',
      detail: `PID ${pid} is still running, so nothing was imported. Type /exit in it and try again.`,
    });
    return null;
  }
  return startSession(session.cwd, session.name, ['claude', '--resume', session.sessionId]);
}

function attach(id, cols, rows) {
  if (ptys.has(id)) return;
  const { TMUX, ...env } = process.env;
  const p = pty.spawn('tmux', ['-u', '-L', SOCKET, 'attach-session', '-t', id], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env,
  });
  p.onData((data) => win?.webContents.send('pty-data', id, data));
  p.onExit(() => {
    ptys.delete(id);
    win?.webContents.send('pty-exit', id);
    pushSessions();
  });
  ptys.set(id, p);
}

function buildMenu() {
  const sessionItems = Array.from({ length: 9 }, (_, i) => ({
    label: `Session ${i + 1}`,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => win?.webContents.send('select-index', i),
  }));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: 'Sessions',
        submenu: [
          {
            label: 'New Session…',
            accelerator: 'CmdOrCtrl+N',
            click: () => win?.webContents.send('request-new-session'),
          },
          {
            label: 'Import Running Session…',
            accelerator: 'CmdOrCtrl+I',
            click: () => win?.webContents.send('request-import'),
          },
          { type: 'separator' },
          ...sessionItems,
        ],
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Appearance',
            submenu: [
              ['system', 'Match System'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ].map(([theme, label]) => ({
              label,
              type: 'radio',
              checked: nativeTheme.themeSource === theme,
              click: () => setAppearance(theme),
            })),
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Panopticode',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1b1f' : '#fafaf9',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    lastSessionsJson = '';
    pushSessions();
  });
  win.on('closed', () => {
    win = null;
  });
}

ipcMain.handle('new-session', newSession);
ipcMain.on('rename', (_, id, name) => renameSession(id, name));
ipcMain.handle('close-for-todo', (_, id) => closeForTodo(id));
ipcMain.handle('reopen-for-todo', (_, itemId, closedSession) => reopenForTodo(itemId, closedSession));
ipcMain.on('session-menu', (_, id) => {
  Menu.buildFromTemplate([
    { label: 'Rename…', click: () => win?.webContents.send('rename-request', id) },
    { type: 'separator' },
    { label: 'Close Session…', click: () => closeSession(id) },
  ]).popup({ window: win });
});
ipcMain.handle('get-appearance', () => nativeTheme.themeSource);
ipcMain.handle('get-colours', () => {
  const { todo, session } = readJson(PREFS_PATH(), {}).colours ?? PRESETS[0];
  return { todo, session };
});
ipcMain.on('set-colours', (_, { todo, session }) => {
  if (![todo, session].every((c) => HEX_COLOUR.test(c))) return;
  writeJson(PREFS_PATH(), { ...readJson(PREFS_PATH(), {}), colours: { todo, session } });
});
ipcMain.on('set-appearance', (_, theme) => setAppearance(theme));
ipcMain.handle('todos-get', () => {
  if (!today) refreshTodos(listSessions());
  return today;
});
ipcMain.on('todos-save', (_, day) => {
  if (day.key !== today?.key) return;
  today = day;
  saveToday();
});
ipcMain.handle('list-external', listExternal);
ipcMain.handle('import-session', (_, pid) => importSession(pid));
ipcMain.on('attach', (_, id, cols, rows) => attach(id, cols, rows));
ipcMain.on('input', (_, id, data) => ptys.get(id)?.write(data));
ipcMain.on('resize', (_, id, cols, rows) => ptys.get(id)?.resize(cols, rows));

app.setName('Panopticode');
app.whenReady().then(() => {
  // One-time carry-over from when the app was called Claude Deck.
  migrate(path.join(os.homedir(), '.claude-deck', 'todos'), TODO_DIR);
  for (const old of ['Claude Deck', 'claude-deck']) {
    migrate(path.join(app.getPath('appData'), old, 'preferences.json'), PREFS_PATH());
  }
  nativeTheme.themeSource = readJson(PREFS_PATH(), {}).theme ?? 'system';
  buildMenu();
  createWindow();
  setInterval(() => {
    pushSessions();
    tryPendingRenames();
  }, 1000);
});

// Closing the window detaches from tmux; the Claude sessions keep running.
app.on('window-all-closed', () => {
  for (const p of ptys.values()) p.kill();
  app.quit();
});
