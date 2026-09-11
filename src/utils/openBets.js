/**
 * Shaping for the open-bets panel.
 *
 * Kept out of the component so the ordering, the labels and the summary line
 * can be tested directly - they're the parts that are easy to get subtly wrong
 * with real wager data (a parlay has no single kickoff, a bet can be missing
 * gameData entirely, "tomorrow" depends on the reader's clock).
 */

// A parlay has no single kickoff; the first leg to start is what matters,
// because that's when the wager stops being cancellable.
export function startMs(wager) {
  const source = wager?.legs
    ? wager.legs.map(l => l?.gameData?.gameStartTime).filter(Boolean).sort()[0]
    : wager?.gameData?.gameStartTime
  if (!source) return Infinity
  const t = new Date(source).getTime()
  return Number.isNaN(t) ? Infinity : t
}

// Carries the zone deliberately. The board prints ESPN's own string ("8:00 PM
// EDT") while this renders the viewer's local clock, so on a machine outside
// Eastern the same kickoff shows two different times a few inches apart. The
// abbreviation is what makes that read as two zones rather than a bug.
export function clockOf(ms) {
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

export function dayOf(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return ''
  const day = new Date(ms)
  const today = new Date(now)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(day, today)) return 'today'
  if (same(day, tomorrow)) return 'tomorrow'
  return day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function matchupOf(wager) {
  if (wager?.legs) return wager.legs.map(l => l?.selection).filter(Boolean).join(' · ')
  const data = wager?.gameData
  if (!data) return ''
  if (data.awayTeam && data.homeTeam) return `${data.awayTeam} @ ${data.homeTeam}`
  return data.gameName || ''
}

/**
 * Open wagers that aren't already on screen as live, soonest kickoff first.
 * `liveKeys` is the set of keys the live list has already claimed, so nothing
 * is listed twice.
 */
export function buildUpcoming(pendingBets = [], pendingParlays = [], liveKeys = new Set(), now = Date.now()) {
  const items = []

  for (const bet of pendingBets) {
    const key = `b-${bet._id}`
    if (liveKeys.has(key)) continue
    items.push({ key, isParlay: false, wager: bet, at: startMs(bet) })
  }
  for (const parlay of pendingParlays) {
    const key = `p-${parlay._id}`
    if (liveKeys.has(key)) continue
    items.push({ key, isParlay: true, wager: parlay, at: startMs(parlay) })
  }

  return items
    .sort((a, b) => a.at - b.at)
    .map(item => ({
      ...item,
      kickoff: clockOf(item.at),
      when: dayOf(item.at, now),
      matchup: matchupOf(item.wager),
      urgency: urgencyOf(item.at, now),
      // A wager can be pulled right up until its game starts. Nothing in this
      // list is live, but a kickoff can still have passed with no scores in
      // yet, so check the clock rather than assuming. The server enforces the
      // same rule, so a stale button fails loudly rather than quietly.
      cancellable: item.at > now
    }))
}

/**
 * The line that has to carry the panel when it's collapsed, so closing it
 * never hides the fact that money is riding.
 */
export function summarize(openCount, liveCount, atRisk) {
  if (!openCount) return ''
  const parts = [`${openCount} open`]
  if (liveCount) parts.push(`${liveCount} in play`)
  parts.push(`$${Number(atRisk || 0).toLocaleString()} at risk`)
  return parts.join(' · ')
}

export function totalAtRisk(pendingBets = [], pendingParlays = []) {
  return [...pendingBets, ...pendingParlays]
    .reduce((total, w) => total + (w?.amount || 0), 0)
}

/**
 * How close a wager is to mattering. Drives the card's colour, so the list
 * reads at a glance: what's running now, what's about to, what can wait.
 */
export function urgencyOf(at, now = Date.now()) {
  if (!Number.isFinite(at)) return 'later'
  const delta = at - now
  if (delta <= 0) return 'live'
  if (delta <= 60 * 60 * 1000) return 'soon'
  if (delta <= 12 * 60 * 60 * 1000) return 'today'
  return 'later'
}

const MARKET_LABELS = { spread: 'Spread', moneyline: 'Moneyline', total: 'Total' }

export function marketLabel(betType) {
  return MARKET_LABELS[String(betType || '').toLowerCase()] || 'Wager'
}

/**
 * A parlay leg spelled out. Collapsed, a parlay can only say "2-leg parlay" and
 * list the picks by name, which doesn't tell you what you actually bet - this
 * is what the row expands into.
 */
export function describeLeg(leg, now = Date.now()) {
  const at = startMs(leg)
  return {
    urgency: urgencyOf(at, now),
    market: marketLabel(leg?.betType),
    selection: leg?.selection || '',
    line: leg?.line ?? null,
    betType: leg?.betType,
    odds: leg?.odds || '',
    game: matchupOf(leg),
    kickoff: clockOf(at),
    when: dayOf(at, now),
    status: leg?.status || 'pending'
  }
}

export function placedAt(wager) {
  const t = wager?.createdAt
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}
