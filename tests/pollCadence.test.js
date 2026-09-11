import test from 'node:test'
import assert from 'node:assert/strict'
import { nextPollDelay, LIVE_MS, IDLE_MIN_MS, IDLE_MAX_MS, IN_PLAY_WINDOW_MS } from '../src/utils/pollCadence.js'

const NOW = Date.parse('2026-09-11T18:00:00Z')
const at = (offsetMs) => new Date(NOW + offsetMs).toISOString()
const game = (id, offsetMs) => ({ gameId: id, sport: 'ncaa-football', gameStartTime: at(offsetMs) })

test('nothing tracked means no polling at all', () => {
  assert.equal(nextPollDelay([], new Map(), NOW), null)
})

test('a game in play polls at live speed', () => {
  const scores = new Map([['g1', { isLive: true, isCompleted: false }]])
  assert.equal(nextPollDelay([game('g1', -3600e3)], scores, NOW), LIVE_MS)
})

test('kickoff has passed but no data yet is treated as live', () => {
  assert.equal(nextPollDelay([game('g1', -60e3)], new Map(), NOW), LIVE_MS)
})

test('one live game outweighs any number of idle ones', () => {
  const games = [game('a', 864e5), game('b', 864e5), game('c', -3600e3)]
  const scores = new Map([['c', { isLive: true, isCompleted: false }]])
  assert.equal(nextPollDelay(games, scores, NOW), LIVE_MS)
})

test('a game tomorrow waits, capped at the idle maximum', () => {
  assert.equal(nextPollDelay([game('g1', 864e5)], new Map(), NOW), IDLE_MAX_MS)
})

test('a game starting soon polls at its kickoff, not sooner', () => {
  const delay = nextPollDelay([game('g1', 2 * 60e3)], new Map(), NOW)
  assert.equal(delay, 2 * 60e3)
})

test('a kickoff beyond the idle ceiling checks back at the ceiling', () => {
  // Converges rather than sleeping through it: the next poll lands 3 minutes
  // out, and by then the kickoff is inside the window.
  assert.equal(nextPollDelay([game('g1', 5 * 60e3)], new Map(), NOW), IDLE_MAX_MS)
})

test('an imminent kickoff still respects the idle floor', () => {
  const delay = nextPollDelay([game('g1', 5e3)], new Map(), NOW)
  assert.equal(delay, IDLE_MIN_MS)
})

test('a final game with an open wager waits on the server, briefly', () => {
  const scores = new Map([['g1', { isLive: false, isCompleted: true }]])
  assert.equal(nextPollDelay([game('g1', -4 * 3600e3)], scores, NOW), IDLE_MIN_MS)
})

test('games with no start time fall back to the idle maximum', () => {
  assert.equal(nextPollDelay([{ gameId: 'g1', sport: 'nba' }], new Map(), NOW), IDLE_MAX_MS)
})

test('a game long past with no data stops driving live speed', () => {
  // Fell out of ESPN's window, or the id never matched. Waiting on it forever
  // at 25s was the bug this guards.
  const delay = nextPollDelay([game('g1', -12 * 3600e3)], new Map(), NOW)
  assert.equal(delay, IDLE_MAX_MS)
})

test('a game that just kicked off is still polled at live speed', () => {
  assert.equal(nextPollDelay([game('g1', -30 * 60e3)], new Map(), NOW), LIVE_MS)
})

test('a stale game does not mask a real live one', () => {
  const games = [game('stale', -12 * 3600e3), game('live', -60 * 60e3)]
  assert.equal(nextPollDelay(games, new Map(), NOW), LIVE_MS)
})
