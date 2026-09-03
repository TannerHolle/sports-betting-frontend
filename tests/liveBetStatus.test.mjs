// Run with: npm test  (node's built-in runner, no dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { getLiveBetStatus, getParlayLiveStatus } from '../src/utils/liveBetStatus.js'

// Ducks 24, Beavers 20 -> margin 4, total 44
const LIVE = { homeTeam: 'Ducks', awayTeam: 'Beavers', homeScore: '24', awayScore: '20', isLive: true }
const bet = (betType, selection, line = null) => ({ betType, selection, line })
const state = (b, live = LIVE) => getLiveBetStatus(b, live)?.state ?? null

test('moneyline', async (t) => {
  await t.test('leader is winning, trailer is losing', () => {
    assert.equal(state(bet('moneyline', 'Ducks')), 'winning')
    assert.equal(state(bet('moneyline', 'Beavers')), 'losing')
  })
  await t.test('a tie is tied, not a win', () => {
    const tied = { ...LIVE, awayScore: '24' }
    assert.equal(state(bet('moneyline', 'Ducks'), tied), 'tied')
  })
  await t.test('says how many points are needed to lead', () => {
    assert.match(getLiveBetStatus(bet('moneyline', 'Beavers'), LIVE).detail, /5 points/)
  })
})

test('spread', async (t) => {
  await t.test('favourite covering and not covering', () => {
    assert.equal(state(bet('spread', 'Ducks', '-3.5')), 'winning')
    assert.equal(state(bet('spread', 'Ducks', '-7.5')), 'losing')
  })
  await t.test('underdog against the number', () => {
    assert.equal(state(bet('spread', 'Beavers', '+7.5')), 'winning')
    assert.equal(state(bet('spread', 'Beavers', '+2.5')), 'losing')
  })
  await t.test('sitting exactly on the number reads as a push', () => {
    assert.equal(state(bet('spread', 'Ducks', '-4')), 'tied')
    assert.equal(state(bet('spread', 'Beavers', '+4')), 'tied')
  })
  await t.test('reports the gap to the number', () => {
    assert.match(getLiveBetStatus(bet('spread', 'Ducks', '-7.5'), LIVE).headline, /3\.5/)
  })
})

test('total', async (t) => {
  await t.test('over and under against 44 points', () => {
    assert.equal(state(bet('total', 'Over', '41.5')), 'winning')
    assert.equal(state(bet('total', 'Over', '47.5')), 'losing')
    assert.equal(state(bet('total', 'Under', '47.5')), 'winning')
    assert.equal(state(bet('total', 'Under', '41.5')), 'losing')
  })
  await t.test('exact total is a push', () => {
    assert.equal(state(bet('total', 'Over', '44')), 'tied')
    assert.equal(state(bet('total', 'Under', '44')), 'tied')
  })
  await t.test('tolerates o/u prefixes', () => {
    assert.equal(state(bet('total', 'Over', 'o41.5')), 'winning')
    assert.equal(state(bet('total', 'Under', 'u41.5')), 'losing')
  })
  await t.test('says how many points an over still needs', () => {
    assert.match(getLiveBetStatus(bet('total', 'Over', '47.5'), LIVE).headline, /3\.5/)
  })
})

test('returns null rather than guessing', async (t) => {
  await t.test('when the game is not live', () => {
    assert.equal(getLiveBetStatus(bet('moneyline', 'Ducks'), { ...LIVE, isLive: false }), null)
    assert.equal(getLiveBetStatus(bet('moneyline', 'Ducks'), null), null)
  })
  await t.test('when the selection matches neither team', () => {
    assert.equal(getLiveBetStatus(bet('moneyline', 'Sharks'), LIVE), null)
    assert.equal(getLiveBetStatus(bet('spread', 'Sharks', '-3'), LIVE), null)
  })
  await t.test('when a spread or total has no readable line', () => {
    assert.equal(getLiveBetStatus(bet('spread', 'Ducks', null), LIVE), null)
    assert.equal(getLiveBetStatus(bet('total', 'Over', 'abc'), LIVE), null)
  })
  await t.test('on an unknown bet type', () => {
    assert.equal(getLiveBetStatus(bet('parlay', 'Ducks'), LIVE), null)
  })
})

test('team names normalise the way the resolver does', () => {
  assert.equal(state(bet('moneyline', 'ducks')), 'winning')
  const amp = { ...LIVE, homeTeam: 'Texas A&M' }
  assert.equal(getLiveBetStatus(bet('moneyline', 'Texas A and M'), amp).state, 'winning')
})

test('parlay rollup', async (t) => {
  const scores = new Map([['g1', { isLive: true }], ['g2', { isLive: true }]])
  const parlay = (statuses) => ({
    legs: statuses.map((s, i) => ({ gameId: `g${i + 1}`, status: s }))
  })

  await t.test('counts settled and live legs', () => {
    const r = getParlayLiveStatus(parlay(['won', 'pending']), scores)
    assert.equal(r.won, 1)
    assert.equal(r.liveLegs, 1)
    assert.equal(r.total, 2)
  })
  await t.test('one dead leg means the parlay is losing', () => {
    assert.equal(getParlayLiveStatus(parlay(['lost', 'pending']), scores).state, 'losing')
  })
  await t.test('all legs in means winning', () => {
    assert.equal(getParlayLiveStatus(parlay(['won', 'won']), scores).state, 'winning')
  })
  await t.test('a push counts toward the parlay surviving', () => {
    assert.equal(getParlayLiveStatus(parlay(['push', 'won']), scores).state, 'winning')
  })
  await t.test('null on an empty parlay', () => {
    assert.equal(getParlayLiveStatus({ legs: [] }, scores), null)
    assert.equal(getParlayLiveStatus(null, scores), null)
  })
})
