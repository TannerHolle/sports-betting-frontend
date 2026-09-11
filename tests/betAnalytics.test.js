import test from 'node:test'
import assert from 'node:assert/strict'
import { profitOf, breakEvenOf, summarize, summarizeBy, edgeOf, isSettled } from '../src/utils/betAnalytics.js'

const bet = (status, amount, potentialWin, odds = '-110', extra = {}) =>
  ({ status, amount, potentialWin, odds, ...extra })

test('profit is winnings, the stake, or nothing', () => {
  assert.equal(profitOf(bet('won', 100, 91)), 91)
  assert.equal(profitOf(bet('lost', 100, 91)), -100)
  assert.equal(profitOf(bet('push', 100, 91)), 0)
})

test('break-even is the reciprocal of the decimal price', () => {
  // -110 pays 0.909 on 1, so you need 52.38% just to stand still
  assert.ok(Math.abs(breakEvenOf(bet('won', 10, 9.09, '-110')) - 0.5238) < 0.001)
  assert.equal(breakEvenOf(bet('won', 10, 10, '+100')), 0.5)
  assert.ok(Math.abs(breakEvenOf(bet('won', 10, 25, '+250')) - 0.2857) < 0.001)
  assert.equal(breakEvenOf(bet('won', 10, 10, 'nonsense')), null)
})

test('a coin-flip record at -110 is a loss, and says so', () => {
  const bets = [...Array(50)].map(() => bet('won', 100, 91))
    .concat([...Array(50)].map(() => bet('lost', 100, 91)))
  const s = summarize(bets)
  assert.equal(s.winRate, 0.5)
  assert.equal(s.profit, 50 * 91 - 50 * 100)   // -450
  assert.ok(s.profit < 0)
  assert.ok(s.breakEven > s.winRate, 'break-even must sit above a 50% record at -110')
  assert.ok(edgeOf(s) < 0)
})

test('a losing-looking record on big underdogs can still be profitable', () => {
  // 30% on +250 dogs: 3 wins at +25, 7 losses at -10
  const bets = [...Array(3)].map(() => bet('won', 10, 25, '+250'))
    .concat([...Array(7)].map(() => bet('lost', 10, 25, '+250')))
  const s = summarize(bets)
  assert.equal(s.winRate, 0.3)
  assert.equal(s.profit, 5)
  assert.ok(edgeOf(s) > 0, 'a 30% rate clears a 28.6% bar')
})

test('pushes return the stake and leave the rate alone', () => {
  const s = summarize([bet('won', 100, 91), bet('lost', 100, 91), bet('push', 100, 91)])
  assert.equal(s.push, 1)
  assert.equal(s.winRate, 0.5)          // decided by the two that resolved
  assert.equal(s.wagered, 200)          // the push is not money at risk
  assert.equal(s.profit, -9)
})

test('break-even counts bets, matching how win rate counts them', () => {
  // A stake-weighted bar would sit near the big -110 bet (~.52). Win rate is
  // count-based, so the bar has to be too, or edge compares two different
  // things - that mismatch showed up as a negative edge beside a real profit.
  const s = summarize([bet('won', 1000, 909, '-110'), bet('lost', 10, 25, '+250')])
  const expected = (0.5238 + 0.2857) / 2
  assert.ok(Math.abs(s.breakEven - expected) < 0.002, 'got ' + s.breakEven)
})

test('pending bets are ignored entirely', () => {
  assert.equal(isSettled({ status: 'pending' }), false)
  const s = summarize([bet('pending', 100, 91), bet('won', 100, 91)])
  assert.equal(s.settled, 1)
  assert.equal(s.profit, 91)
})

test('an empty slate reports nothing rather than zero-divides', () => {
  const s = summarize([])
  assert.equal(s.roi, null)
  assert.equal(s.winRate, null)
  assert.equal(s.breakEven, null)
  assert.equal(edgeOf(s), null)
})

test('grouping splits by key and drops unsettled', () => {
  const bets = [
    bet('won', 100, 91, '-110', { betType: 'spread' }),
    bet('lost', 100, 91, '-110', { betType: 'spread' }),
    bet('won', 50, 125, '+250', { betType: 'moneyline' }),
    bet('pending', 50, 125, '+250', { betType: 'moneyline' })
  ]
  const by = summarizeBy(bets, b => b.betType)
  assert.equal(by.get('spread').settled, 2)
  assert.equal(by.get('moneyline').settled, 1)
  assert.equal(by.get('moneyline').profit, 125)
})
