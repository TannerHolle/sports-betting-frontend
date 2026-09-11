/**
 * How long to wait before asking ESPN again, given the games we're tracking.
 *
 * A fixed interval spends the same number of requests at 4am on a Tuesday as
 * it does during a live fourth quarter. Nothing in play means nothing to
 * learn, so the cadence stretches toward the next kickoff and snaps back to
 * live speed the moment a game is actually running.
 *
 * Bet resolution is not what drives this: the server settles bets on its own
 * pass. The client polls only to keep scores on screen current.
 */

export const LIVE_MS = 25000              // something is in play
export const IDLE_MIN_MS = 60000          // never busier than this when idle
export const IDLE_MAX_MS = 3 * 60 * 1000   // and never lazier than this

// How long after kickoff a game with no data is still presumed to be running.
// Past this it isn't late, it's missing - it fell out of ESPN's window, or the
// id never matched. Without a bound, one such game pins the cadence at live
// speed permanently.
export const IN_PLAY_WINDOW_MS = 6 * 60 * 60 * 1000

const startMs = (game) => {
  const t = game?.gameStartTime
  if (!t) return NaN
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? NaN : d.getTime()
}

/**
 * @param trackedGames [{ gameId, sport, gameStartTime }]
 * @param scores       Map<gameId, { isLive, isCompleted }> from the last poll
 * @returns ms to wait, or null to stop polling entirely
 */
export function nextPollDelay(trackedGames = [], scores = new Map(), now = Date.now()) {
  if (!trackedGames.length) return null

  let soonestKickoff = Infinity
  let waitingOnSettlement = false

  for (const game of trackedGames) {
    const live = scores.get(String(game.gameId))

    // In play - nothing else matters, poll at live speed
    if (live?.isLive) return LIVE_MS

    const start = startMs(game)

    // Kickoff has passed but we have no live data yet: it may have just
    // started, or ESPN may be slow to flip the state. Treat it as live, but
    // only for as long as a game could plausibly still be running.
    if (!live && !Number.isNaN(start) && start <= now) {
      if (now - start < IN_PLAY_WINDOW_MS) return LIVE_MS
      continue // long past and still unknown - nothing to wait for
    }

    // Final on ESPN but the wager is still open - the server's resolver will
    // settle it shortly. Keep looking, but don't idle all the way out.
    if (live?.isCompleted) {
      waitingOnSettlement = true
      continue
    }

    if (!Number.isNaN(start) && start > now) {
      soonestKickoff = Math.min(soonestKickoff, start - now)
    }
  }

  if (waitingOnSettlement) return IDLE_MIN_MS
  if (soonestKickoff === Infinity) return IDLE_MAX_MS

  return Math.min(Math.max(soonestKickoff, IDLE_MIN_MS), IDLE_MAX_MS)
}
