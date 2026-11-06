# Decisions (signed off by Steph, 2026-10-14)

1. Build our own app, inspired by [agent-deck](https://github.com/asheshgoplani/agent-deck).
2. Electron desktop window + tmux backend. Each selected session is shown by running
   `tmux attach` inside an embedded xterm.js terminal.
3. tmux runs on a separate socket: `tmux -L claude-deck`.
4. Status comes from Claude Code hooks installed globally in `~/.claude/settings.json`.
   The hook does nothing unless the session was launched by this app (`CLAUDE_DECK_ID` set).
5. A finished turn (`Stop`) shows as "waiting for you", like agent-deck.
6. First version includes a "New session" button with a native folder picker.
7. Theme follows macOS light/dark.
8. UI text in British English; DM Sans for UI, monospace for terminals.

## Revised 2026-10-14

9. Import running sessions by resume: the app lists running interactive sessions
   (`claude agents --json`) and reopens one with `claude --resume <sessionId>` in its folder.
   Tested: history and session ID carry over; a second live process shares the same transcript,
   so the original must be closed.
10. Before importing, the app asks for confirmation, then closes the original process (SIGTERM)
    and starts the resumed one. The iTerm2 window stays open at a shell prompt.
11. Steph's existing terminal sessions run in Terminal.app (not iTerm2, as first thought).
12. Session names use the terminal title Claude sets (tmux `pane_title`, leading status glyph
    stripped); fallback is the folder name. The window title shows "title — folder".
13. Dock badge shows the number of sessions waiting for you.
14. View → Appearance: Match System / Light / Dark, remembered between launches.
15. ADHD mode, from the [i-have-adhd](https://github.com/ayghri/i-have-adhd) Claude Code plugin by
    @ayghri, is a clever way to get clearer, easier-to-follow feedback in each session: answers
    come action-first, in numbered steps, without filler. It needs no app change: its always-on
    hook already fires in app sessions (verified in a transcript).
16. The import list hides sessions running in the Claude desktop app.
17. A visible "System · Light · Dark" switch sits at the bottom of the sidebar (synced with the
    View → Appearance menu).
18. "Today's TODOs" is its own entry at the top of the sidebar. It has a checklist plus a
    free-text notes area.
19. Linking: every app session automatically gets a TODO row; any TODO can also be linked to a
    session by hand. Linked rows show the session's live status and open its terminal.
20. Each day gets its own file. Unticked items and the notes carry over to the next day; ticked
    items stay with their day. Rows with no text are not carried over (they hold nothing you wrote).
21. TODOs have an optional urgency from 1 to 5 (5 = most urgent).
22. The sidebar shows the top 5 TODOs: unticked and with text, most urgent first; equal or no
    urgency → oldest first. No urgency ranks below 1.
23. Clicking a sidebar TODO opens its linked session, or Today's TODOs if it has none.
24. Rename: right-click a session → Rename…, edited inline (Enter saves, Esc cancels).
    The name is stored by the app (tmux option `@deck_custom`) and overrides Claude's title;
    clearing it goes back to Claude's title.
25. Rename also types `/rename <name>` into Claude (tested: changes Claude's session name, not the
    terminal title). It is only typed when the last hook says Claude is at its prompt and the
    input line holds no draft (only the dimmed placeholder); otherwise it waits and retries.
26. Sidebar sessions are grouped by status: Waiting for you, Error, Working, Idle. Empty
    sections are hidden. Sections fold on click and stay folded after restart.
    ⌘1–9 stay tied to session age, so numbers do not jump when a session changes section.
27. Close: right-click → Close Session…, confirm, then Claude is sent SIGTERM (same as import)
    and its tmux session ends. The conversation is kept and resumable with `claude --resume`.
28. Colour: the sidebar has two blocks. Today's TODOs is pink and Sessions is green (palette C),
    with dark-mode variants. The TODOs page header is tinted pink, and each terminal gets a thin
    green title bar (status dot, session name, folder).
29. Block colours are settings, not hardcoded: a Colours panel offers presets (Violet & teal,
    the default; Coral & blue; Pink & green) plus a colour picker per block. Every shade
    (tint, border, text, badge) is derived from the picked colour with CSS color-mix, for both
    light and dark mode. Saved in the app's preferences file.
30. In light mode, Claude's code-word colour (256-colour 153, #afd7ff) is replaced with #1f5fbf
    through xterm's extendedAnsi palette. (A minimum-contrast setting was tried and rejected:
    it made code words look like body text.)
31. Ticked TODOs move to a "Done" list on the TODOs page. Unticking moves them back.
32. Ticking a TODO linked to a running session asks "Also close this session?" (Close Session /
    Keep Running), warning if Claude is working. Closing stores the Claude session ID, folder and
    name on the TODO.
33. A Done TODO with a closed session has "Reopen": it resumes the conversation in the app
    (`claude --resume`), links it to the TODO, moves the TODO back to the open list and opens
    the terminal.

## Revised 2026-11-06

34. The app is renamed from Claude Deck to Panopticode, so its name no longer uses "Claude".
    The tmux socket, data folder (`~/.panopticode/`), session variable (`PANOPTICODE_ID`) and
    hook script (`panopticode-hook.js`) follow the new name. Internal identifiers (the `deck`
    window API, the `@deck_` tmux options) are unchanged.
35. On first launch after the rename, the app copies TODOs from `~/.claude-deck/todos/` and the
    appearance and colour preferences from the old app folder, once, and only when nothing exists
    at the new location. The old files are left in place.
36. `remove-hooks` also removes hooks installed under the old name.
37. The Colours button leaves the sidebar; the Colours panel opens from View → Colours…
    The light/dark switch stays in the sidebar, since it is used often.
38. "New" is the primary button (filled with the session colour); "Import" stays secondary.
39. The sidebar blocks have neutral backgrounds and borders. Block colours remain on headings,
    counts, the TODOs page underline and the terminal title bar's left edge, so status colours
    (waiting, error, working) are the strongest colours on screen. Supersedes the tinted blocks
    in 28.
40. Urgency is set with five dots instead of a dropdown: click a dot to set the level, click the
    current level again to clear it. Filled dots take the low/medium/high colour.
41. The Sessions heading uses sentence case like "Today's TODOs", so the two blocks match.
42. On launch the app takes its PATH from the user's login shell (with Homebrew and
    `~/.local/bin` as fallbacks), because apps opened outside a terminal get a minimal PATH and
    could not find `tmux` or `claude`. New sessions are started with that PATH explicitly, so they
    work even if the tmux server was started earlier with a shorter one.
43. If `claude` is missing, Import shows a clear message instead of failing silently.
