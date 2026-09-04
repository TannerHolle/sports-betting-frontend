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
import { formatLine } from '../utils/oddsMath.js'
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

    return { isAuthenticated, liveWagers, loading, displayLine: formatLine, legState, legStanding }
  }
}
</script>

<style scoped>
.live-bets {
  display: flex;
  flex-direction: column;
}

.lb-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
}

.lb-header h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

.lb-pulse {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
  animation: lb-pulse 2s infinite;
}

@keyframes lb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.lb-count,
.lb-loading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.lb-loading { padding: var(--space-4) 0; }

/* Rows on hairlines rather than stacked cards — a live slate reads as a list */
.lb-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.lb-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.lb-pick {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
}

.lb-line,
.lb-odds {
  font-family: var(--font-mono);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.lb-line { font-size: var(--text-base); color: var(--color-text); }
.lb-odds { font-size: var(--text-sm); color: var(--color-text-subtle); }

.lb-standing {
  display: inline-flex;
  align-items: center;
  padding: 3px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

/* states come from utils/liveBetStatus.js: winning | losing | tied | live,
   plus settled leg statuses won | lost | push */
.lb-standing.winning,
.lb-standing.won { background: var(--color-success-soft); color: var(--color-success); }

.lb-standing.losing,
.lb-standing.lost { background: var(--color-danger-soft); color: var(--color-danger); }

.lb-standing.tied,
.lb-standing.push { background: var(--color-warning-soft); color: var(--color-warning); }

.lb-standing.live { background: var(--color-primary-soft); color: var(--color-primary); }

.lb-score {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.lb-teams {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.lb-clock {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.lb-legs {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-1);
}

.lb-leg {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.lb-dot {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex: 0 0 auto;
}

.lb-dot.winning, .lb-dot.won { background: var(--color-success); }
.lb-dot.losing, .lb-dot.lost { background: var(--color-danger); }
.lb-dot.tied, .lb-dot.push { background: var(--color-warning); }

.lb-leg-pick {
  flex: 1 1 0;
  min-width: 0;
  color: var(--color-text-muted);
}

.lb-leg-standing {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.lb-leg-standing.winning, .lb-leg-standing.won { color: var(--color-success); }
.lb-leg-standing.losing, .lb-leg-standing.lost { color: var(--color-danger); }
.lb-leg-standing.tied, .lb-leg-standing.push { color: var(--color-warning); }

.lb-bottom {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: var(--text-sm);
}

.lb-detail { color: var(--color-text-muted); }

.lb-stake {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .lb-top,
  .lb-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>
