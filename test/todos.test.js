const test = require('node:test');
const assert = require('node:assert/strict');
const { dayKey, startDay, syncSessions, topTodos, linkReopened } = require('../src/todos');

const item = (id, text, done = false, sessionId = null) => ({ id, text, done, sessionId });

test('dayKey uses the local date', () => {
  assert.equal(dayKey(new Date(2026, 9, 4, 23, 59)), '2026-10-04');
});

test('a new day keeps unticked items with text and the notes', () => {
  const previous = {
    items: [item('a', 'Carry me'), item('b', 'Done', true), item('c', '', false, 'd1')],
    notes: 'Remember the 3pm call',
  };

  assert.deepEqual(startDay(previous), { items: [item('a', 'Carry me')], notes: 'Remember the 3pm call' });
  assert.deepEqual(startDay(null), { items: [], notes: '' });
});

test('every session gets one linked row; existing rows are untouched', () => {
  const day = { items: [item('a', 'Mine', false, 'd1'), item('b', 'Unlinked')], notes: '' };

  const synced = syncSessions(day, ['d1', 'd2'], () => 'new');

  assert.deepEqual(synced.items, [...day.items, item('new', '', false, 'd2')]);
  assert.equal(syncSessions(synced, ['d1', 'd2'], () => 'x'), synced);
});

test('top TODOs: most urgent first, then oldest; ticked and empty rows left out', () => {
  const items = [
    { ...item('old', 'Oldest'), urgency: null },
    { ...item('u3', 'Urgency 3'), urgency: 3 },
    { ...item('done', 'Ticked', true), urgency: 5 },
    { ...item('empty', '', false, 'd1'), urgency: 5 },
    { ...item('u5', 'Urgency 5'), urgency: 5 },
    item('noField', 'No urgency field'),
    { ...item('u1', 'Urgency 1'), urgency: 1 },
    { ...item('u3b', 'Urgency 3 newer'), urgency: 3 },
  ];

  assert.deepEqual(
    topTodos(items, 5).map((i) => i.id),
    ['u5', 'u3', 'u3b', 'u1', 'old'],
  );
});

test('reopening links the TODO to the new session and moves it back to open', () => {
  const closedSession = { claudeSessionId: 'c1', cwd: '/a', name: 'Docs work' };
  const day = { items: [{ ...item('t1', 'Fix docs', true, 'old'), closedSession }, item('t2', 'Other')], notes: '' };

  const reopened = linkReopened(day, 't1', 'dnew');

  assert.deepEqual(reopened.items[0], item('t1', 'Fix docs', false, 'dnew'));
  assert.deepEqual(reopened.items[1], day.items[1]);
  assert.deepEqual(syncSessions(reopened, ['dnew'], () => 'x'), reopened);
});
