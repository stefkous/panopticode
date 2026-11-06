# Panopticode

One window for all your Claude Code sessions, with a daily TODO list linked to them.

> An unofficial companion app for [Claude Code](https://claude.com/claude-code). Not affiliated
> with or endorsed by Anthropic.

![Panopticode: sessions grouped by status, with Today's TODOs](docs/screenshot.png)

## Why the name

Jeremy Bentham's panopticon is a circular building designed so that
one person at the centre can see every cell at once. I use mine to keep an eye on my AI agents.

## Why I built it

I run several Claude Code sessions at once, each in its own terminal tab. I kept losing track
of which one was waiting for me, which had failed, and what each was for. Panopticode puts them
in one window, sorts them by what needs my attention, and ties each session to a TODO so the
work and the reason for it stay together.

## Features

- **Sessions grouped by status:** Waiting for you, Error, Working, Idle. ⌘1–9 to switch, and a
  Dock badge when a session needs you.
- **The real Claude terminal inside,** so permission prompts and slash commands work as normal.
- **Import** a session already running in Terminal or iTerm2: it closes the original and
  reopens the same conversation here.
- **Today's TODOs:** a checklist with urgency 1–5, linked to sessions with live status, a Done
  list, and the top 5 shown in the sidebar. Unfinished items carry over to the next day.
- **Close and reopen from a TODO:** ticking a TODO can close its session; reopening it later
  resumes the same conversation.
- New, rename (right-click) and close sessions. Light/dark switch and colour presets.

## How it works

- **Electron + xterm.js** for the window and terminals.
- **tmux** on its own socket (`tmux -L panopticode`) keeps sessions alive when the window
  closes.
- **Claude Code hooks** report each session's status. The hook writes a small JSON file per
  session and does nothing for sessions this app didn't start.
- Logic (status mapping, TODO carry-over and ranking, tmux parsing, import detection) lives in
  small pure modules with unit tests; `main.js` wires them to Electron.

[`DECISIONS.md`](DECISIONS.md) records every design decision, including what was tried and
rejected.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 20 or newer
- tmux: `brew install tmux`
- Claude Code (`claude`) installed and logged in

## Setup

```bash
git clone https://github.com/stefkous/panopticode.git
cd panopticode
npm install
npm run install-hooks
npm start
```

`npm run install-hooks` adds status hooks to `~/.claude/settings.json` and saves a backup next
to it first. To undo:

```bash
npm run remove-hooks
```

## Good to know

- Closing the window does not stop your sessions; they are there when you reopen the app.
- TODOs are saved per day in `~/.panopticode/todos/`.
- `npm test` runs the tests.

## Credits

Inspired by [agent-deck](https://github.com/asheshgoplani/agent-deck), a terminal session
manager for AI coding agents. Panopticode takes the idea to a macOS desktop app, with a daily
TODO list linked to each session.

## License

[ISC](LICENSE)
