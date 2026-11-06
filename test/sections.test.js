const test = require('node:test');
const assert = require('node:assert/strict');
const { groupByStatus } = require('../src/sections');

test('groups sessions by status in priority order, keeping shortcut numbers and hiding empty', () => {
  const sessions = [
    { id: 'a', state: 'idle' },
    { id: 'b', state: 'working' },
    { id: 'c', state: 'waiting' },
    { id: 'd', state: 'idle' },
  ];

  assert.deepEqual(groupByStatus(sessions), [
    { state: 'waiting', label: 'Waiting for you', sessions: [{ session: sessions[2], index: 2 }] },
    { state: 'working', label: 'Working', sessions: [{ session: sessions[1], index: 1 }] },
    {
      state: 'idle',
      label: 'Idle',
      sessions: [
        { session: sessions[0], index: 0 },
        { session: sessions[3], index: 3 },
      ],
    },
  ]);
});
