// Where a wager stands against a game that is still being played.
//
// betResolver.determineBetOutcome answers the same question for a FINAL score
// and refuses to grade anything unfinished. This is the in-progress version:
// it never settles anything, it just says whether you're currently on the right
// side and what still has to happen.

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()

const namesMatch = (a, b) => norm(a) === norm(b) && norm(a) !== ''

// Spreads keep their sign; totals may arrive as "o47.5" / "u47.5"
const parseLine = (line, betType) => {
  if (line === null || line === undefined) return null
  const raw = betType === 'total' ? String(line).replace(/^[ouOU]/i, '') : String(line)
  const n = parseFloat(raw)
  return Number.isNaN(n) ? null : n
}

const plural = (n, word) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`

/**
 * @returns {{state: 'winning'|'losing'|'tied', headline: string, detail: string}|null}
 *          null when the game hasn't started or the bet can't be read.
 */
export const getLiveBetStatus = (bet, live) => {
  if (!bet || !live || !live.isLive) return null

  const home = Number(live.homeScore) || 0
  const away = Number(live.awayScore) || 0
  const total = home + away

  const pickIsHome = namesMatch(bet.selection, live.homeTeam)
  const pickIsAway = namesMatch(bet.selection, live.awayTeam)

  if (bet.betType === 'moneyline') {
    if (!pickIsHome && !pickIsAway) return null
    const mine = pickIsHome ? home : away
    const theirs = pickIsHome ? away : home
    const margin = mine - theirs
    if (margin > 0) return { state: 'winning', headline: `Up ${margin}`, detail: 'Winning outright' }
    if (margin < 0) return { state: 'losing', headline: `Down ${Math.abs(margin)}`, detail: `Needs ${plural(Math.abs(margin) + 1, 'point')} to lead` }
    return { state: 'tied', headline: 'Tied', detail: 'Needs to take the lead' }
  }

  if (bet.betType === 'spread') {
    if (!pickIsHome && !pickIsAway) return null
    const line = parseLine(bet.line, 'spread')
    if (line === null) return null
    const mine = pickIsHome ? home : away
    const theirs = pickIsHome ? away : home
    const margin = mine + line - theirs      // > 0 means currently covering
    if (margin > 0) return { state: 'winning', headline: `Covering by ${Math.abs(margin)}`, detail: 'Ahead of the number' }
    if (margin < 0) return { state: 'losing', headline: `Short by ${Math.abs(margin)}`, detail: `Needs ${plural(Math.abs(margin), 'more point')}` }
    return { state: 'tied', headline: 'On the number', detail: 'Currently a push' }
  }

  if (bet.betType === 'total') {
    const line = parseLine(bet.line, 'total')
    if (line === null) return null
    const isOver = String(bet.selection).toLowerCase() === 'over'
    const diff = total - line
    if (isOver) {
      if (diff > 0) return { state: 'winning', headline: `Over by ${Math.abs(diff)}`, detail: `${total} scored` }
      if (diff < 0) return { state: 'losing', headline: `Needs ${Math.abs(diff)}`, detail: `${total} of ${line}` }
      return { state: 'tied', headline: 'On the number', detail: `${total} scored` }
    }
    if (diff < 0) return { state: 'winning', headline: `Under by ${Math.abs(diff)}`, detail: `${total} of ${line}` }
    if (diff > 0) return { state: 'losing', headline: `Over by ${Math.abs(diff)}`, detail: `${total} scored` }
    return { state: 'tied', headline: 'On the number', detail: `${total} scored` }
  }

  return null
}

// Roll a parlay's legs up into one line: settled legs count as decided, live
// legs use their current standing.
export const getParlayLiveStatus = (parlay, scoresById) => {
  if (!parlay?.legs?.length) return null

  let won = 0
  let lost = 0
  let liveLegs = 0

  for (const leg of parlay.legs) {
    if (leg.status === 'won' || leg.status === 'push') { won++; continue }
    if (leg.status === 'lost') { lost++; continue }
    const live = scoresById.get(String(leg.gameId))
    if (live?.isLive) liveLegs++
  }

  return {
    won,
    lost,
    liveLegs,
    total: parlay.legs.length,
    // one dead leg kills it, so surface that above everything else
    state: lost > 0 ? 'losing' : (won === parlay.legs.length ? 'winning' : 'live')
  }
}
