import test from 'node:test'
import assert from 'node:assert/strict'
import { startMs, clockOf, dayOf, matchupOf, buildUpcoming, summarize, totalAtRisk, marketLabel, describeLeg, placedAt, urgencyOf } from '../src/utils/openBets.js'

const NOW = Date.parse('2026-09-11T18:00:00Z')
const DAY = 864e5

const bet = (id, startISO, extra = {}) => ({
  _id: id, amount: 25, potentialWin: 23, odds: '-112', selection: 'Kansas', line: '+5.5',
  gameData: { gameStartTime: startISO, homeTeam: 'Kansas', awayTeam: 'Missouri', gameName: 'Missouri Tigers at Kansas Jayhawks' },
  ...extra
})

test('a parlay starts when its earliest leg does', () => {
  const parlay = { _id: 'p1', amount: 10, legs: [
    { gameData: { gameStartTime: '2026-09-12T00:00Z' } },
    { gameData: { gameStartTime: '2026-09-11T23:00Z' } }
  ] }
  assert.equal(startMs(parlay), Date.parse('2026-09-11T23:00Z'))
})

test('a wager with no game data sorts last rather than crashing', () => {
  assert.equal(startMs({ _id: 'x' }), Infinity)
  assert.equal(matchupOf({ _id: 'x' }), '')
})

test('matchup reads away at home, and a parlay lists its picks', () => {
  assert.equal(matchupOf(bet('b1', '2026-09-12T00:00Z')), 'Missouri @ Kansas')
  assert.equal(matchupOf({ legs: [{ selection: 'Duke' }, { selection: 'Over 140' }] }), 'Duke · Over 140')
})

test('day labels are relative to the reader, not absolute', () => {
  assert.equal(dayOf(NOW, NOW), 'today')
  assert.equal(dayOf(NOW + DAY, NOW), 'tomorrow')
  assert.match(dayOf(NOW + 5 * DAY, NOW), /Sep/)
})

test('upcoming is ordered by kickoff, soonest first', () => {
  const bets = [
    bet('late', '2026-09-13T00:00Z'),
    bet('soon', '2026-09-11T19:00Z'),
    bet('mid', '2026-09-12T00:00Z')
  ]
  const rows = buildUpcoming(bets, [], new Set(), NOW)
  assert.deepEqual(rows.map(r => r.wager._id), ['soon', 'mid', 'late'])
})

test('a wager already listed as live is not repeated below', () => {
  const bets = [bet('b1', '2026-09-12T00:00Z'), bet('b2', '2026-09-12T00:00Z')]
  const rows = buildUpcoming(bets, [], new Set(['b-b1']), NOW)
  assert.deepEqual(rows.map(r => r.key), ['b-b2'])
})

test('straight bets and parlays are interleaved by kickoff', () => {
  const bets = [bet('b1', '2026-09-12T02:00Z')]
  const parlays = [{ _id: 'p1', amount: 10, legs: [{ gameData: { gameStartTime: '2026-09-11T19:00Z' } }] }]
  const rows = buildUpcoming(bets, parlays, new Set(), NOW)
  assert.deepEqual(rows.map(r => r.key), ['p-p1', 'b-b1'])
})

test('the collapsed summary still carries the money', () => {
  assert.equal(summarize(2, 1, 1250), '2 open · 1 in play · $1,250 at risk')
  assert.equal(summarize(1, 0, 25), '1 open · $25 at risk')
  assert.equal(summarize(0, 0, 0), '')
})

test('at-risk totals straight bets and parlays together', () => {
  assert.equal(totalAtRisk([{ amount: 25 }, { amount: 10 }], [{ amount: 5 }]), 40)
  assert.equal(totalAtRisk([{}], []), 0)
})

test('the kickoff label names its zone, so it cannot be misread as the board time', () => {
  // The board prints ESPN's Eastern string; this prints the viewer's clock.
  // Without the abbreviation the two look contradictory on a non-Eastern machine.
  const label = clockOf(Date.parse('2026-09-12T00:00Z'))
  assert.match(label, /\d{1,2}:\d{2}\s?(AM|PM)\s+[A-Z]{2,5}/)
})

test('a missing kickoff degrades to a dash', () => {
  assert.equal(clockOf(Infinity), '—')
})

test('a wager is cancellable until its game starts', () => {
  const rows = buildUpcoming([bet('soon', '2026-09-11T19:00Z')], [], new Set(), NOW)
  assert.equal(rows[0].cancellable, true)
})

test('a kickoff that has passed is no longer cancellable, even with no scores in', () => {
  const rows = buildUpcoming([bet('started', '2026-09-11T17:00Z')], [], new Set(), NOW)
  assert.equal(rows[0].cancellable, false)
})

test('a parlay stops being cancellable when its earliest leg starts', () => {
  const parlay = { _id: 'p1', amount: 10, legs: [
    { gameData: { gameStartTime: '2026-09-11T17:00Z' } },  // already started
    { gameData: { gameStartTime: '2026-09-12T00:00Z' } }
  ] }
  const rows = buildUpcoming([], [parlay], new Set(), NOW)
  assert.equal(rows[0].cancellable, false)
})

test('market labels read as a bettor would say them', () => {
  assert.equal(marketLabel('spread'), 'Spread')
  assert.equal(marketLabel('moneyline'), 'Moneyline')
  assert.equal(marketLabel('total'), 'Total')
  assert.equal(marketLabel(undefined), 'Wager')
})

test('a leg expands into what was actually bet', () => {
  const leg = {
    betType: 'spread', selection: 'Villanova', line: '+36.5', odds: '-110', status: 'pending',
    gameData: { gameStartTime: '2026-09-11T23:00Z', homeTeam: 'Louisville', awayTeam: 'Villanova' }
  }
  const d = describeLeg(leg, NOW)
  assert.equal(d.market, 'Spread')
  assert.equal(d.selection, 'Villanova')
  assert.equal(d.game, 'Villanova @ Louisville')
  assert.equal(d.status, 'pending')
  assert.match(d.kickoff, /\d{1,2}:\d{2}\s?(AM|PM)/)
})

test('a leg with no game data still describes cleanly', () => {
  const d = describeLeg({ betType: 'moneyline', selection: 'Duke', odds: '+120' }, NOW)
  assert.equal(d.game, '')
  assert.equal(d.kickoff, '—')
  assert.equal(d.status, 'pending')
})

test('placed-at is omitted rather than shown as Invalid Date', () => {
  assert.equal(placedAt({}), '')
  assert.equal(placedAt({ createdAt: 'nonsense' }), '')
  assert.match(placedAt({ createdAt: '2026-09-10T21:02:00Z' }), /Sep/)
})

test('urgency grades a wager by how soon it matters', () => {
  assert.equal(urgencyOf(NOW - 1000, NOW), 'live')
  assert.equal(urgencyOf(NOW + 30 * 60e3, NOW), 'soon')
  assert.equal(urgencyOf(NOW + 5 * 3600e3, NOW), 'today')
  assert.equal(urgencyOf(NOW + 3 * DAY, NOW), 'later')
  assert.equal(urgencyOf(Infinity, NOW), 'later')
})

test('rows carry their urgency for the card to colour by', () => {
  const rows = buildUpcoming([bet('a', '2026-09-11T18:30:00Z')], [], new Set(), NOW)
  assert.equal(rows[0].urgency, 'soon')
})
