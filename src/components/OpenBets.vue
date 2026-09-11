<template>
  <section class="open-bets" v-if="isAuthenticated && (openCount || firstCheck)">
    <button
      type="button"
      class="ob-header"
      :aria-expanded="String(!collapsed)"
      @click="toggle"
    >
      <h3>
        <span class="ob-pulse" v-if="liveWagers.length"></span>
        Your bets
      </h3>
      <span class="ob-summary">{{ summary }}</span>
      <span class="ob-chevron" :class="{ open: !collapsed }" aria-hidden="true"></span>
    </button>

    <div v-if="!collapsed" class="ob-body">
      <div v-if="firstCheck" class="ob-loading">Checking your open bets…</div>

      <!-- in play first: this is what you're actually watching -->
      <div v-for="item in liveWagers" :key="item.key" class="ob-card" :class="item.state">
        <template v-if="!item.isParlay">
          <div class="ob-top">
            <div class="ob-pick">
              <span class="ob-flag live">Live</span>
              {{ item.bet.selection }}
              <span v-if="item.bet.line" class="ob-line">{{ displayLine(item.bet) }}</span>
              <span class="ob-odds">{{ item.bet.odds }}</span>
            </div>
            <div class="ob-standing" :class="item.state">{{ item.headline }}</div>
          </div>
          <div class="ob-score">
            <span class="ob-teams">{{ item.live.awayTeam }} {{ item.live.awayScore }} — {{ item.live.homeScore }} {{ item.live.homeTeam }}</span>
            <span class="ob-clock">{{ item.live.status }}</span>
          </div>
          <div class="ob-bottom">
            <span class="ob-detail">{{ item.detail }}</span>
            <span class="ob-stake">${{ item.bet.amount.toLocaleString() }} → ${{ item.bet.potentialWin.toLocaleString() }}</span>
          </div>
        </template>

        <template v-else>
          <div class="ob-top">
            <div class="ob-pick">
              <span class="ob-flag live">Live</span>
              {{ item.bet.legs.length }}-leg parlay
              <span class="ob-odds">{{ item.bet.odds }}</span>
            </div>
            <div class="ob-standing" :class="item.state">
              {{ item.rollup.won }}/{{ item.rollup.total }} legs
            </div>
          </div>
          <div class="ob-legs">
            <div v-for="(leg, i) in item.bet.legs" :key="i" class="ob-leg">
              <span class="ob-dot" :class="legState(leg, item)"></span>
              <span class="ob-leg-pick">
                {{ leg.selection }}
                <span v-if="leg.line" class="ob-line">{{ displayLine(leg) }}</span>
              </span>
              <span class="ob-leg-standing" :class="legState(leg, item)">{{ legStanding(leg) }}</span>
            </div>
          </div>
          <div class="ob-bottom">
            <span class="ob-detail">
              {{ item.rollup.lost > 0 ? 'A leg has gone down' : `${item.rollup.liveLegs} leg${item.rollup.liveLegs === 1 ? '' : 's'} in play` }}
            </span>
            <span class="ob-stake">${{ item.bet.amount.toLocaleString() }} → ${{ item.bet.potentialWin.toLocaleString() }}</span>
          </div>
        </template>
      </div>

      <!-- then what hasn't kicked off, soonest first -->
      <div
        v-for="item in upcomingWagers"
        :key="item.key"
        class="ob-card upcoming"
        :class="[item.urgency, { open: isRowOpen(item.key) }]"
      >
        <!-- The whole line toggles, not just the marker. Cancel stops the
             event so it can't expand the row on its way to the modal. -->
        <div class="ob-rowline" @click="toggleRow(item.key)">
          <!-- No visible marker: the card is the affordance, and the detail
               below is its own answer to open-or-closed. This stays a real
               button so keyboard and screen-reader users still have one
               labelled target - it just carries no chrome of its own. Cancel
               sits outside it, since a button can't contain another. -->
          <button
            type="button"
            class="ob-rowbtn"
            :aria-expanded="String(isRowOpen(item.key))"
            :aria-label="(isRowOpen(item.key) ? 'Hide' : 'Show') + ' details for ' + rowLabel(item)"
            @click.stop="toggleRow(item.key)"
          >
            <span class="ob-top">
              <span class="ob-pick">
                <span class="ob-flag">{{ item.kickoff }}</span>
                <span class="ob-market" v-if="!item.isParlay">{{ marketOf(item.wager) }}</span>
                <span class="ob-market parlay" v-else>Parlay</span>
                <template v-if="!item.isParlay">
                  {{ item.wager.selection }}
                  <span v-if="item.wager.line" class="ob-line">{{ displayLine(item.wager) }}</span>
                </template>
                <template v-else>{{ item.wager.legs.length }} legs</template>
                <span class="ob-odds">{{ item.wager.odds }}</span>
              </span>
            </span>
            <span class="ob-bottom">
              <span class="ob-detail">{{ item.matchup }}</span>
            </span>
          </button>

          <span class="ob-side">
            <span class="ob-stake">
              ${{ item.wager.amount.toLocaleString() }}
              <span class="ob-arrow">→</span>
              <span class="ob-payout">${{ item.wager.potentialWin.toLocaleString() }}</span>
            </span>
            <span class="ob-sidefoot">
              <span class="ob-when">{{ item.when }}</span>
              <button
                v-if="item.cancellable"
                type="button"
                class="ob-cancel"
                :disabled="cancelling"
                @click.stop="askCancel(item)"
              >Cancel</button>
            </span>
          </span>
        </div>

        <div v-if="isRowOpen(item.key)" class="ob-expand">
          <!-- a parlay: every leg spelled out -->
          <template v-if="item.isParlay">
            <div v-for="(leg, i) in legsOf(item.wager)" :key="i" class="ob-legrow">
              <span class="ob-dot" :class="leg.status === 'pending' ? leg.urgency : leg.status"></span>
              <span class="ob-legmain">
                <span class="ob-legpick">
                  {{ leg.selection }}
                  <span v-if="leg.line" class="ob-line">{{ displayLine(leg) }}</span>
                  <span class="ob-odds">{{ leg.odds }}</span>
                </span>
                <span class="ob-legmeta">{{ leg.market }} · {{ leg.game }}</span>
              </span>
              <span class="ob-legwhen">{{ leg.kickoff }} · {{ leg.when }}</span>
            </div>
            <div class="ob-expandfoot">
              <span>Combined {{ item.wager.odds }} · placed {{ placedOn(item.wager) }}</span>
              <span>${{ item.wager.amount.toLocaleString() }} to win ${{ item.wager.potentialWin.toLocaleString() }}</span>
            </div>
          </template>

          <!-- a straight bet: the market, the game and when it was taken -->
          <template v-else>
            <div class="ob-strip">
              <div class="ob-stat">
                <span class="ob-factkey">Market</span>
                <span class="ob-factval">{{ marketOf(item.wager) }}</span>
              </div>
              <div class="ob-stat">
                <span class="ob-factkey">Starts</span>
                <span class="ob-factval">{{ item.kickoff }} · {{ item.when }}</span>
              </div>
              <div class="ob-stat">
                <span class="ob-factkey">Placed</span>
                <span class="ob-factval">{{ placedOn(item.wager) || '—' }}</span>
              </div>
              <div class="ob-stat">
                <span class="ob-factkey">Stake</span>
                <span class="ob-factval">${{ item.wager.amount.toLocaleString() }}</span>
              </div>
              <div class="ob-stat">
                <span class="ob-factkey">To win</span>
                <span class="ob-factval positive">${{ item.wager.potentialWin.toLocaleString() }}</span>
              </div>
            </div>
          </template>
        </div>

        <p v-if="errors[item.key]" class="ob-error">{{ errors[item.key] }}</p>
      </div>
    </div>

    <!-- Pulling a wager returns money, so it asks first -->
    <div v-if="pending" class="ob-modal-overlay" @click.self="closeCancel">
      <div class="ob-modal">
        <h4>Cancel this {{ pending.isParlay ? 'parlay' : 'bet' }}?</h4>
        <p class="ob-modal-pick">{{ pending.label }}</p>
        <p class="ob-modal-info">
          <strong>${{ pending.wager.amount.toLocaleString() }}</strong> goes back to your balance.
        </p>
        <div class="ob-modal-actions">
          <button type="button" class="ob-modal-keep" :disabled="cancelling" @click="closeCancel">Keep it</button>
          <button type="button" class="ob-modal-confirm" :disabled="cancelling" @click="confirmCancel">
            {{ cancelling ? 'Cancelling…' : 'Cancel it' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { formatLine } from '../utils/oddsMath.js'
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
import { getLiveBetStatus, getParlayLiveStatus } from '../utils/liveBetStatus.js'
import { nextPollDelay } from '../utils/pollCadence.js'
import { useCollapsible } from '../composables/useCollapsible.js'
import { buildUpcoming, summarize, totalAtRisk, describeLeg, marketLabel, placedAt } from '../utils/openBets.js'

/**
 * Every open wager, at the top of the page where the ledger already promises
 * it.
 *
 * This used to be "Live Now", which only rendered while a game was actually
 * running - so a bet placed on tomorrow's game appeared nowhere above the
 * fold, and the only way to see it was to scroll past the entire board to the
 * history panel. The ledger says ACTIVE BETS 1; this is the answer to "which
 * one?" sitting next to the number.
 *
 * Settled bets stay in the history panel below. This is a glance, not an
 * archive, which is what keeps it short enough to leave open.
 */
export default {
  name: 'OpenBets',
  setup() {
    const userStore = useUserStore()
    const scores = ref(new Map())
    const loading = ref(false)
    const settled = ref(false) // a first check has come back this session
    const timer = ref(null)

    const { collapsed, toggle } = useCollapsible('openBetsCollapsed')

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    // Which rows are expanded. Per-session rather than persisted: you open a
    // row to answer a question, not to set a preference.
    const openRows = ref(new Set())
    const isRowOpen = (key) => openRows.value.has(key)
    const toggleRow = (key) => {
      const next = new Set(openRows.value)
      next.has(key) ? next.delete(key) : next.add(key)
      openRows.value = next
    }

    const rowLabel = (item) => item.isParlay
      ? `${item.wager.legs.length}-leg parlay`
      : `${item.wager.selection}${item.wager.line ? ' ' + formatLine(item.wager) : ''}`

    const legsOf = (parlay) => (parlay?.legs || []).map(leg => describeLeg(leg))
    const marketOf = (wager) => marketLabel(wager?.betType)
    const placedOn = (wager) => placedAt(wager)

    const pending = ref(null)      // the wager awaiting confirmation
    const cancelling = ref(false)
    const errors = reactive({})

    const askCancel = (item) => {
      errors[item.key] = ''
      pending.value = {
        key: item.key,
        isParlay: item.isParlay,
        wager: item.wager,
        label: item.isParlay
          ? `${item.wager.legs.length}-leg parlay`
          : `${item.wager.selection}${item.wager.line ? ' ' + formatLine(item.wager) : ''}`
      }
    }

    const closeCancel = () => {
      if (cancelling.value) return
      pending.value = null
    }

    const confirmCancel = async () => {
      const target = pending.value
      if (!target || cancelling.value) return

      cancelling.value = true
      try {
        const result = target.isParlay
          ? await userStore.cancelParlay(target.wager._id)
          : await userStore.cancelBet(target.wager._id)

        if (result.success) {
          pending.value = null
        } else {
          errors[target.key] = result.error || 'Could not cancel that'
          pending.value = null
        }
      } finally {
        cancelling.value = false
      }
    }

    const pendingBets = computed(() =>
      (currentUser.value?.bets || []).filter(b => b.status === 'pending'))
    const pendingParlays = computed(() =>
      (currentUser.value?.parlays || []).filter(p => p.status === 'pending'))

    // Every game any open wager touches, so one fetch per sport covers them all
    const trackedGames = computed(() => {
      const out = []
      const add = (w) => out.push({
        gameId: w.gameId,
        sport: w.sport,
        gameStartTime: w.gameData?.gameStartTime || null
      })
      pendingBets.value.forEach(add)
      pendingParlays.value.forEach(p =>
        p.legs.filter(l => l.status === 'pending').forEach(add))
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

    // Anything open that isn't already shown as live, soonest kickoff first
    const upcomingWagers = computed(() => buildUpcoming(
      pendingBets.value,
      pendingParlays.value,
      new Set(liveWagers.value.map(i => i.key))
    ))

    const openCount = computed(() => liveWagers.value.length + upcomingWagers.value.length)

    const summary = computed(() => summarize(
      openCount.value,
      liveWagers.value.length,
      totalAtRisk(pendingBets.value, pendingParlays.value)
    ))

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

    // The placeholder is only honest before the first result is in. Showing it
    // on every poll made the whole section mount and unmount every 25s.
    const firstCheck = computed(() => loading.value && !settled.value)

    const refresh = async () => {
      if (!trackedGames.value.length) {
        scores.value = new Map()
        settled.value = true
        return
      }
      loading.value = true
      try {
        scores.value = await liveScoreService.getScoresForBets(trackedGames.value)
      } finally {
        loading.value = false
        settled.value = true
      }
    }

    // Same pattern as the scoreboard: don't poll a hidden tab. The delay comes
    // from what's actually happening rather than a fixed interval - see
    // pollCadence.
    const schedule = () => {
      stop()
      if (document.hidden) return
      const delay = nextPollDelay(trackedGames.value, scores.value)
      if (delay === null) return
      timer.value = setTimeout(async () => {
        await refresh()
        schedule()
      }, delay)
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

    return {
      isAuthenticated,
      liveWagers,
      upcomingWagers,
      openCount,
      summary,
      collapsed,
      toggle,
      firstCheck,
      isRowOpen,
      toggleRow,
      rowLabel,
      legsOf,
      marketOf,
      placedOn,
      pending,
      cancelling,
      errors,
      askCancel,
      closeCancel,
      confirmCancel,
      displayLine: formatLine,
      legState,
      legStanding
    }
  }
}
</script>

<style scoped>
.open-bets {
  display: flex;
  flex-direction: column;
}

/* The whole header is the toggle, so the hit target matches what it looks like */
.ob-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  width: 100%;
  padding: 0 0 var(--space-2);
  background: none;
  border: none;
  border-bottom: 1.5px solid var(--color-text);
  border-radius: 0;
  /* `font: inherit`, not just font-family: a button keeps the UA's 13.33px
     and line-height:normal otherwise, which made this header 23px tall
     against the 27px of the rail's plain-div header - so the two panel rules
     sat 4px apart. The h3 inside picks up the inherited line-height too. */
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ob-header h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
  white-space: nowrap;
}

/* Carries the count and the stake, so collapsing never hides the headline */
.ob-summary {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ob-chevron {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-bottom: 2px;
  border-right: 1.5px solid var(--color-text-muted);
  border-bottom: 1.5px solid var(--color-text-muted);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
}

.ob-chevron.open { transform: rotate(45deg); }

.ob-header:hover .ob-chevron { border-color: var(--color-text); }

.ob-pulse {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
  animation: ob-pulse 2s infinite;
}

@keyframes ob-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.ob-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.ob-loading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  padding: var(--space-4) 0;
}

/* Marks what a row is: a live game, or the time one starts */
.ob-flag {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.ob-flag.live { color: var(--color-danger); }

/* Not yet started: quieter than a game in progress */
.ob-card.upcoming .ob-pick { font-size: var(--text-base); }

.ob-when {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.ob-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ob-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.ob-pick {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
}

.ob-line,
.ob-odds {
  font-family: var(--font-mono);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ob-line { font-size: var(--text-base); color: var(--color-text); }
.ob-odds { font-size: var(--text-sm); color: var(--color-text-subtle); }

.ob-standing {
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
.ob-standing.winning,
.ob-standing.won { background: var(--color-success-soft); color: var(--color-success); }

.ob-standing.losing,
.ob-standing.lost { background: var(--color-danger-soft); color: var(--color-danger); }

.ob-standing.tied,
.ob-standing.push { background: var(--color-warning-soft); color: var(--color-warning); }

.ob-standing.live { background: var(--color-primary-soft); color: var(--color-primary); }

.ob-score {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.ob-teams {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.ob-clock {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.ob-legs {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-1);
}

.ob-leg {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.ob-dot {
  display: block;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex: 0 0 auto;
}

.ob-dot.winning, .ob-dot.won { background: var(--color-success); }
.ob-dot.losing, .ob-dot.lost { background: var(--color-danger); }
.ob-dot.tied, .ob-dot.push { background: var(--color-warning); }

.ob-leg-pick {
  flex: 1 1 0;
  min-width: 0;
  color: var(--color-text-muted);
}

.ob-leg-standing {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.ob-leg-standing.winning, .ob-leg-standing.won { color: var(--color-success); }
.ob-leg-standing.losing, .ob-leg-standing.lost { color: var(--color-danger); }
.ob-leg-standing.tied, .ob-leg-standing.push { color: var(--color-warning); }

.ob-bottom {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: var(--text-sm);
}

.ob-detail { color: var(--color-text-muted); }

.ob-stake {
  /* spaced by the box, not by source whitespace - the template's line breaks
     collapse and ran the arrow into the payout */
  display: inline-flex;
  align-items: baseline;
  gap: 0.35em;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .ob-top,
  .ob-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}

.ob-cancel {
  padding: 0;
  background: none;
  border: none;
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.ob-cancel:hover:not(:disabled) { color: var(--color-danger); }
.ob-cancel:disabled { opacity: 0.5; cursor: default; }

.ob-error {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--color-danger);
}

/* The page background is a brand gradient, so a panel needs its own opaque
   ground or it reads as floating text */
.ob-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.45);
}

.ob-modal {
  width: 100%;
  max-width: 380px;
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.ob-modal h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.ob-modal-pick {
  margin: 0 0 var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.ob-modal-info {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.ob-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.ob-modal-keep,
.ob-modal-confirm {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.ob-modal-keep {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text);
}

.ob-modal-confirm {
  background: var(--color-danger);
  border: 1px solid var(--color-danger);
  color: #fff;
}

.ob-modal-keep:disabled,
.ob-modal-confirm:disabled { opacity: 0.6; cursor: default; }

/* Every wager is a card, open or not. Previously only an expanded row got a
   card and it bled past the column rule above it - sized to the column and
   applied to all of them, the list reads as a stack and nothing shifts when
   one opens. */
.ob-card {
  padding: var(--space-3) var(--space-3) var(--space-3) calc(var(--space-3) + 3px);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  /* inset so state changes never nudge the layout */
  box-shadow: inset 0 0 0 1px var(--color-border);
  transition: box-shadow 0.15s ease;
}

.ob-card.open { box-shadow: inset 0 0 0 1px var(--color-border-strong); }
.ob-card:hover { box-shadow: inset 0 0 0 1px var(--color-border-strong); }

.ob-rowline {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  cursor: pointer;
}

/* Carries no chrome - the card is the affordance */
.ob-rowbtn {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.ob-rowbtn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.ob-rowbtn > .ob-top,
.ob-rowbtn > .ob-bottom { display: flex; width: 100%; }

.ob-side {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

.ob-sidefoot {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-3);
}

/* Detail sits flush with the pick above it, inside the card */
.ob-expand {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ob-legrow {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.ob-legrow + .ob-legrow { border-top: 1px solid var(--color-border); }

/* meta rides beside the pick rather than under it */
.ob-legmain {
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ob-legmain {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ob-legpick {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.ob-legmeta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.ob-legwhen {
  flex: 0 0 auto;
  text-align: right;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ob-expandfoot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* One rule-divided strip instead of five stacked rows, echoing the ledger band
   at the top of the page. Uses the width that was sitting empty, and cuts the
   expanded height by about two thirds. */
.ob-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) 0;
}

.ob-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 var(--space-4);
  border-left: 1px solid var(--color-border);
}

.ob-stat:first-child { padding-left: 0; border-left: none; }

.ob-factkey {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.ob-factval {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ob-factval.positive { color: var(--color-success); }

@media (max-width: 720px) {
  .ob-rowline { flex-direction: column; gap: var(--space-2); }
  .ob-side { align-items: flex-start; }
}

/* Colour that carries meaning rather than decoration: the rail says how soon
   this wager is live, so the stack reads at a glance. */
.ob-card {
  position: relative;
  overflow: hidden;
}

.ob-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--color-text-subtle);
}

/* "later" is the quiet end of the scale, but it still has to look chosen.
   border-strong managed 1.85:1 against the card in light and 1.70:1 in dark,
   which read as an unpainted edge rather than a state; text-subtle lands at
   3.45:1 / 3.93:1 - visibly the calmest of the four, against ~6:1 for the
   other three. */
.ob-card.live::before  { background: var(--color-danger); }
.ob-card.soon::before  { background: var(--color-warning); }
.ob-card.today::before { background: var(--color-primary); }
.ob-card.later::before { background: var(--color-text-subtle); }

/* Market chip - names the bet type and gives the row an accent */
.ob-market {
  flex: 0 0 auto;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.ob-market.parlay {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.ob-arrow { color: var(--color-text-subtle); }
.ob-payout { color: var(--color-success); }

/* pending legs echo the card rail: red running, amber imminent, blue today */
.ob-dot.live  { background: var(--color-danger); }
.ob-dot.soon  { background: var(--color-warning); }
.ob-dot.today { background: var(--color-primary); }
.ob-dot.later { background: var(--color-text-subtle); }
</style>
