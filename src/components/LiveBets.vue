<template>
  <div class="live-bets" v-if="isAuthenticated && (liveWagers.length || loading)">
    <div class="lb-header">
      <h3>
        <span class="lb-pulse"></span>
        Live Now
      </h3>
      <span class="lb-count" v-if="liveWagers.length">
        {{ liveWagers.length }} wager{{ liveWagers.length === 1 ? '' : 's' }} in play
      </span>
    </div>

    <div v-if="loading && !liveWagers.length" class="lb-loading">Checking your open bets…</div>

    <div v-for="item in liveWagers" :key="item.key" class="lb-card" :class="item.state">
      <!-- straight bet -->
      <template v-if="!item.isParlay">
        <div class="lb-top">
          <div class="lb-pick">
            {{ item.bet.selection }}
            <span v-if="item.bet.line" class="lb-line">{{ displayLine(item.bet) }}</span>
            <span class="lb-odds">{{ item.bet.odds }}</span>
          </div>
          <div class="lb-standing" :class="item.state">{{ item.headline }}</div>
        </div>
        <div class="lb-score">
          <span class="lb-teams">{{ item.live.awayTeam }} {{ item.live.awayScore }} — {{ item.live.homeScore }} {{ item.live.homeTeam }}</span>
          <span class="lb-clock">{{ item.live.status }}</span>
        </div>
        <div class="lb-bottom">
          <span class="lb-detail">{{ item.detail }}</span>
          <span class="lb-stake">${{ item.bet.amount.toLocaleString() }} → ${{ item.bet.potentialWin.toLocaleString() }}</span>
        </div>
      </template>

      <!-- parlay -->
      <template v-else>
        <div class="lb-top">
          <div class="lb-pick">
            {{ item.bet.legs.length }}-leg parlay
            <span class="lb-odds">{{ item.bet.odds }}</span>
          </div>
          <div class="lb-standing" :class="item.state">
            {{ item.rollup.won }}/{{ item.rollup.total }} legs
          </div>
        </div>
        <div class="lb-legs">
          <div v-for="(leg, i) in item.bet.legs" :key="i" class="lb-leg">
            <span class="lb-dot" :class="legState(leg, item)"></span>
            <span class="lb-leg-pick">
              {{ leg.selection }}
              <span v-if="leg.line" class="lb-line">{{ displayLine(leg) }}</span>
            </span>
            <span class="lb-leg-standing" :class="legState(leg, item)">{{ legStanding(leg) }}</span>
          </div>
        </div>
        <div class="lb-bottom">
          <span class="lb-detail">
            {{ item.rollup.lost > 0 ? 'A leg has gone down' : `${item.rollup.liveLegs} leg${item.rollup.liveLegs === 1 ? '' : 's'} in play` }}
          </span>
          <span class="lb-stake">${{ item.bet.amount.toLocaleString() }} → ${{ item.bet.potentialWin.toLocaleString() }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
import { getLiveBetStatus, getParlayLiveStatus } from '../utils/liveBetStatus.js'

const REFRESH_MS = 25000

export default {
  name: 'LiveBets',
  setup() {
    const userStore = useUserStore()
    const scores = ref(new Map())
    const loading = ref(false)
    const timer = ref(null)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const pendingBets = computed(() =>
      (currentUser.value?.bets || []).filter(b => b.status === 'pending'))
    const pendingParlays = computed(() =>
      (currentUser.value?.parlays || []).filter(p => p.status === 'pending'))

    // Every game any open wager touches, so one fetch per sport covers them all
    const trackedGames = computed(() => {
      const out = []
      pendingBets.value.forEach(b => out.push({ gameId: b.gameId, sport: b.sport }))
      pendingParlays.value.forEach(p =>
        p.legs.filter(l => l.status === 'pending')
          .forEach(l => out.push({ gameId: l.gameId, sport: l.sport })))
      return out
    })

    const liveWagers = computed(() => {
      const items = []

      for (const bet of pendingBets.value) {
        const live = scores.value.get(String(bet.gameId))
        const status = getLiveBetStatus(bet, live)
        if (!status) continue
        items.push({ key: `b-${bet._id}`, isParlay: false, bet, live, ...status })
      }

      for (const parlay of pendingParlays.value) {
        const rollup = getParlayLiveStatus(parlay, scores.value)
        if (!rollup || (!rollup.liveLegs && !rollup.lost)) continue
        items.push({
          key: `p-${parlay._id}`,
          isParlay: true,
          bet: parlay,
          rollup,
          state: rollup.state === 'live' ? 'tied' : rollup.state
        })
      }

      // losing first - that's what you want to look at
      const order = { losing: 0, tied: 1, winning: 2 }
      return items.sort((a, b) => (order[a.state] ?? 3) - (order[b.state] ?? 3))
    })

    const legState = (leg, item) => {
      if (leg.status !== 'pending') return leg.status
      const live = item ? scores.value.get(String(leg.gameId)) : null
      const s = getLiveBetStatus(leg, live)
      return s ? s.state : 'pending'
    }

    const legStanding = (leg) => {
      if (leg.status !== 'pending') return leg.status
      const live = scores.value.get(String(leg.gameId))
      const s = getLiveBetStatus(leg, live)
      return s ? s.headline : 'Not started'
    }

    const displayLine = (bet) => {
      if (!bet.line) return ''
      if (bet.betType === 'total') return `${bet.selection === 'Over' ? 'o' : 'u'}${bet.line}`
      const n = parseFloat(bet.line)
      return Number.isNaN(n) ? bet.line : (n > 0 ? `+${n}` : `${n}`)
    }

    const refresh = async () => {
      if (!trackedGames.value.length) {
        scores.value = new Map()
        return
      }
      loading.value = true
      try {
        scores.value = await liveScoreService.getScoresForBets(trackedGames.value)
      } finally {
        loading.value = false
      }
    }

    // Same pattern as the scoreboard: don't poll a hidden tab
    const schedule = () => {
      stop()
      if (document.hidden) return
      timer.value = setTimeout(async () => {
        await refresh()
        schedule()
      }, REFRESH_MS)
    }
    const stop = () => {
      if (timer.value) { clearTimeout(timer.value); timer.value = null }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else { refresh(); schedule() }
    }

    onMounted(() => {
      refresh()
      schedule()
      document.addEventListener('visibilitychange', onVisibility)
    })
    onUnmounted(() => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    })

    return { isAuthenticated, liveWagers, loading, displayLine, legState, legStanding }
  }
}
</script>

<style scoped>
.live-bets {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  margin-bottom: 2rem;
}

.lb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.lb-header h3 {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.lb-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-danger);
  animation: lb-pulse 2s infinite;
}
@keyframes lb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.lb-count { font-size: var(--text-sm); color: var(--color-text-muted); font-weight: 600; }
.lb-loading { color: var(--color-text-muted); font-size: var(--text-sm); }

.lb-card {
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-text-subtle);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 0.75rem;
}
.lb-card.winning { border-left-color: var(--color-success); }
.lb-card.losing { border-left-color: var(--color-danger); }
.lb-card.tied { border-left-color: var(--color-warning); }

.lb-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.lb-pick { font-weight: 700; color: var(--color-text); font-size: var(--text-base); }
.lb-line { color: var(--color-text-muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.lb-odds { color: var(--color-success); margin-left: 6px; font-variant-numeric: tabular-nums; }

.lb-standing {
  font-weight: 700;
  font-size: var(--text-sm);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.lb-standing.winning { color: var(--color-success); }
.lb-standing.losing { color: var(--color-danger); }
.lb-standing.tied { color: #92400e; }

.lb-score {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
  font-variant-numeric: tabular-nums;
}
.lb-teams { font-weight: 600; color: var(--color-text); }
.lb-clock { white-space: nowrap; }

.lb-legs { margin: 0.5rem 0; }
.lb-leg { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0; }
.lb-leg + .lb-leg { border-top: 1px dashed var(--color-border); }
.lb-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--color-text-subtle); }
.lb-dot.winning, .lb-dot.won { background: var(--color-success); }
.lb-dot.losing, .lb-dot.lost { background: var(--color-danger); }
.lb-dot.tied, .lb-dot.push { background: var(--color-warning); }
.lb-leg-pick { flex: 1; font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.lb-leg-standing { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); }
.lb-leg-standing.winning { color: var(--color-success); }
.lb-leg-standing.losing { color: var(--color-danger); }

.lb-bottom {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.lb-stake { font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (max-width: 768px) {
  .live-bets { padding: 1rem; }
  .lb-top, .lb-score, .lb-bottom { flex-direction: column; gap: 0.25rem; align-items: flex-start; }
}
</style>
