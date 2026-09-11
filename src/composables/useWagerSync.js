import { computed, ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
import { API_BASE_URL } from '../config/api.js'

/**
 * Keeps the signed-in user in step with what the server has settled.
 *
 * Scores were already live on screen while the wager they belonged to sat
 * "pending" and the balance didn't move - because nothing ever re-read the
 * user after page load. The server grades bets on its own pass; this is the
 * half that notices.
 *
 * Two speeds, and no polling at all when there's nothing outstanding:
 *  - a game that has started -> check often, a settlement is coming
 *  - everything still ahead   -> wait for the earliest kickoff
 *
 * When a tracked game goes final we don't wait for the server's own timer at
 * all; we ask it to grade now, so settling lands in seconds rather than up to
 * a minute later. The resolver already guards against overlapping passes, so
 * several clients asking at once costs one pass.
 */

const SETTLING_MS = 8000          // a final game, waiting on the payout
const IN_PROGRESS_MS = 30000      // a game running, nothing final yet
const AHEAD_MAX_MS = 5 * 60 * 1000

const startMs = (wager) => {
  const t = wager?.gameData?.gameStartTime
  if (!t) return NaN
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? NaN : d.getTime()
}

export function useWagerSync() {
  const userStore = useUserStore()
  const timer = ref(null)
  const resolving = ref(false)
  // A final game with an open wager on it: the payout is moments away, so
  // check back quickly until it lands rather than at the in-progress rate.
  const awaitingSettlement = ref(false)
  const lastRefresh = ref(0)
  const fingerprint = ref(null)

  const currentUser = computed(() => userStore.currentUser.value)

  // Every open wager, straight or leg, with the kickoff that governs it
  const openWagers = computed(() => {
    const user = currentUser.value
    if (!user) return []

    const out = []
    for (const bet of user.bets || []) {
      if (bet.status === 'pending') out.push(bet)
    }
    for (const parlay of user.parlays || []) {
      if (parlay.status !== 'pending') continue
      for (const leg of parlay.legs || []) {
        if (leg.status === 'pending') out.push(leg)
      }
    }
    return out
  })

  const refreshUser = async () => {
    const username = currentUser.value?.username
    if (!username) return false
    try {
      await userStore.loadUserFromAPI(username)
      return true
    } catch {
      // a missed refresh just means the next tick picks it up
      return false
    }
  }

  // Everything that moves when a wager settles, in one string. The full user
  // record carries every bet ever placed - a quarter of a megabyte on an older
  // account - so we poll this instead and only pull the record when it differs.
  const fingerprintOf = (probe) => [
    probe.balance,
    probe.totalWon,
    probe.totalLost,
    probe.pendingBets,
    probe.pendingParlays
  ].join('|')

  const refreshIfChanged = async () => {
    const username = currentUser.value?.username
    if (!username) return false

    // focus and visibilitychange often fire together; one probe covers both
    if (Date.now() - lastRefresh.value < 1000) return false
    lastRefresh.value = Date.now()

    let probe
    try {
      probe = (await axios.get(`${API_BASE_URL}/user/${username}/sync`)).data
    } catch {
      return false
    }

    const next = fingerprintOf(probe)
    if (next === fingerprint.value) return false

    // First probe of the session only establishes the baseline
    if (fingerprint.value === null) {
      fingerprint.value = next
      return false
    }

    // Commit the new fingerprint only once the record is actually in hand, so
    // a failed read is retried on the next tick rather than silently skipped
    if (await refreshUser()) {
      fingerprint.value = next
      return true
    }
    return false
  }

  // Ask the server to grade now rather than waiting out its interval
  const requestResolution = async () => {
    if (resolving.value) return
    resolving.value = true
    try {
      await axios.post(`${API_BASE_URL}/bets/force-resolve`)
    } catch {
      // the server's own pass will still get to it
    } finally {
      resolving.value = false
    }
  }

  const sync = async () => {
    const wagers = openWagers.value
    if (!wagers.length) return

    const now = Date.now()
    const started = wagers.filter(w => {
      const start = startMs(w)
      return !Number.isNaN(start) && start <= now
    })
    if (!started.length) return

    // Shares liveScoreService's cache with OpenBets, so this is usually free
    const scores = await liveScoreService.getScoresForBets(
      started.map(w => ({ gameId: w.gameId, sport: w.sport }))
    )

    const anyFinal = started.some(w => scores.get(String(w.gameId))?.isCompleted)
    awaitingSettlement.value = anyFinal
    if (anyFinal) await requestResolution()

    await refreshIfChanged()
  }

  const nextDelay = () => {
    const wagers = openWagers.value
    if (!wagers.length) return null

    const now = Date.now()
    let soonest = Infinity
    let anyStarted = false

    for (const wager of wagers) {
      const start = startMs(wager)
      if (Number.isNaN(start)) continue
      if (start <= now) anyStarted = true
      else soonest = Math.min(soonest, start - now)
    }

    if (awaitingSettlement.value) return SETTLING_MS
    if (anyStarted) return IN_PROGRESS_MS
    if (soonest === Infinity) return AHEAD_MAX_MS
    return Math.min(soonest, AHEAD_MAX_MS)
  }

  const schedule = () => {
    stop()
    if (document.hidden) return
    const delay = nextDelay()
    if (delay === null) return
    timer.value = setTimeout(async () => {
      await sync()
      schedule()
    }, delay)
  }

  const stop = () => {
    if (timer.value) { clearTimeout(timer.value); timer.value = null }
  }

  // Coming back to the tab should show current state immediately, not on the
  // next tick - this is where "why hasn't this updated" is felt most.
  const onVisibility = () => {
    if (document.hidden) stop()
    else { refreshIfChanged(); schedule() }
  }

  onMounted(() => {
    schedule()
    // Establish the baseline without pulling the full record
    refreshIfChanged()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', refreshIfChanged)
  })

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', refreshIfChanged)
  })

  return { sync, refreshUser, refreshIfChanged }
}
