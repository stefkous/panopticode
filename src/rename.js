const PROMPT = '❯';
// Claude draws the empty prompt's placeholder text dimmed (SGR 2).
const DIMMED = /\x1b\[2m.*?(\x1b\[(0|22)m|$)/g;
const ESCAPES = /\x1b\[[0-9;]*m/g;

/** True when the last hook event shows Claude sitting at its input prompt, with no dialog open. */
function isAtPrompt(status) {
  if (!status) return false;
  if (status.event === 'Notification') return status.type === 'idle_prompt';
  return status.event === 'Stop' || status.event === 'SessionStart';
}

/** True when the input line (the last prompt on screen, captured with escapes) holds no draft. */
function promptIsEmpty(screen) {
  const inputLine = screen.split('\n').findLast((line) => line.includes(PROMPT));
  if (inputLine === undefined) return false;
  const typed = inputLine.slice(inputLine.indexOf(PROMPT) + PROMPT.length);
  return typed.replace(DIMMED, '').replace(ESCAPES, '').trim() === '';
}

module.exports = { isAtPrompt, promptIsEmpty };
