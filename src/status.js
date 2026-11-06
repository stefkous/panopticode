const STATE_BY_EVENT = {
  SessionStart: 'idle',
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PermissionRequest: 'waiting',
  Notification: 'waiting',
  Stop: 'waiting',
  StopFailure: 'errored',
};

/** Map a Claude Code hook payload to a session state, or null if the event is irrelevant. */
function stateForEvent(event) {
  return STATE_BY_EVENT[event.hook_event_name] ?? null;
}

module.exports = { stateForEvent, STATE_BY_EVENT };
