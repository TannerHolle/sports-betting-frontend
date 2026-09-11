import { americanToDecimal } from './oddsMath.js'

/**
 * What a settled slate of bets actually did.
 *
 * The stats panel used to report win rate alone, which for a bettor is the
 * wrong headline: 49.5% on spreads at -110 is a losing record, while 37.9% on
 * long moneyline underdogs can be a good one. Price is what decides it, so
 * every figure here is money-aware, and each market carries the break-even
 * rate implied by the odds actually taken - the number a win rate has to be
 * read against to mean anything.
 */

const SETTLED = new Set(['won', 'lost', 'push'])

export function isSettled(bet) {
  return SETTLED.has(bet?.status)
}

/** Net money a settled bet returned: winnings, the stake lost, or nothing. */
export function profitOf(bet) {
  if (bet?.status === 'won') return Number(bet.potentialWin) || 0
  if (bet?.status === 'lost') return -(Number(bet.amount) || 0)
  return 0 // push - stake comes back
}

/**
 * The win rate this bet needed just to break even. At decimal odds d the
 * stake is returned too, so p * (d - 1) = (1 - p) * 1 solves to p = 1 / d.
 */
export function breakEvenOf(bet) {
  const d = americanToDecimal(bet?.odds)
  return d && d > 1 ? 1 / d : null
}

export function summarize(bets = []) {
  let won = 0, lost = 0, push = 0
  let wagered = 0, profit = 0
  let breakEvenSum = 0, breakEvenCount = 0

  for (const bet of bets) {
    if (!isSettled(bet)) continue
    if (bet.status === 'won') won++
    else if (bet.status === 'lost') lost++
    else push++

    const stake = Number(bet.amount) || 0
    profit += profitOf(bet)
    if (bet.status !== 'push') {
      wagered += stake
      const be = breakEvenOf(bet)
      // Unweighted on purpose. winRate counts bets, so the bar it is read
      // against has to count them too - weighting this by stake put the two on
      // different footings and produced nonsense like a negative edge next to a
      // positive profit. ROI is where stake size shows up.
      if (be !== null) { breakEvenSum += be; breakEvenCount++ }
    }
  }

  const decided = won + lost
  return {
    won, lost, push,
    settled: decided + push,
    wagered,
    profit,
    roi: wagered > 0 ? profit / wagered : null,
    winRate: decided > 0 ? won / decided : null,
    breakEven: breakEvenCount > 0 ? breakEvenSum / breakEvenCount : null
  }
}

/** Group settled bets by a key, summarised. */
export function summarizeBy(bets = [], keyOf) {
  const buckets = new Map()
  for (const bet of bets) {
    if (!isSettled(bet)) continue
    const key = keyOf(bet)
    if (key === null || key === undefined) continue
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(bet)
  }
  const out = new Map()
  for (const [key, group] of buckets) out.set(key, summarize(group))
  return out
}

/** How far a win rate sits above or below what its prices demanded. */
export function edgeOf(summary) {
  if (!summary || summary.winRate === null || summary.breakEven === null) return null
  return summary.winRate - summary.breakEven
}
