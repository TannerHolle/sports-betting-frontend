<template>
  <section class="today-results" v-if="isAuthenticated && settledToday.length">
    <div class="section-head">
      <h2>Today's results</h2>
      <span class="section-meta">
        {{ settledToday.length }} settled
      </span>
    </div>

    <!-- The answer to "how did I do today" before any of the individual
         wagers: net first, at figure size, because it is the number the
         page is being opened for. -->
    <div class="tr-summary">
      <div class="tr-cell tr-cell-net">
        <span class="eyebrow">Net</span>
        <span class="tr-net figure" :class="netClass">{{ netLabel }}</span>
      </div>
      <div class="tr-cell">
        <span class="eyebrow">Record</span>
        <span class="tr-value figure">{{ record }}</span>
      </div>
      <div class="tr-cell">
        <span class="eyebrow">Staked</span>
        <span class="tr-value figure">${{ staked.toLocaleString() }}</span>
      </div>
      <div class="tr-cell" v-if="returned > 0">
        <span class="eyebrow">Returned</span>
        <span class="tr-value figure">${{ returned.toLocaleString() }}</span>
      </div>
    </div>

    <div class="tr-list">
      <template v-for="item in settledToday" :key="item.key">
        <ParlayCard v-if="item.isParlay" :parlay="item.wager" />
        <BetCard v-else :bet="item.wager" />
      </template>
    </div>
  </section>
</template>

<script>
import { computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import BetCard from './BetCard.vue'
import ParlayCard from './ParlayCard.vue'

/**
 * The day's settled slate, at the top of the dashboard.
 *
 * This used to be a tab in Your Bets at the foot of the page, which meant the
 * one thing you open the app to find out — how today went — took a scroll and
 * a click. Straight bets and parlays are pooled: they carry the same
 * status / amount / potentialWin / resolvedAt shape.
 *
 * "Today" is keyed off resolvedAt the same way userStats.todaysProfitLoss is,
 * so this band and the Today P/L cell in the ledger can never disagree.
 */
export default {
  name: 'TodayResults',
  components: { BetCard, ParlayCard },
  setup() {
    const userStore = useUserStore()

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const settledToday = computed(() => {
      const user = currentUser.value
      if (!user) return []

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const isSettledToday = (wager) => {
        if (!['won', 'lost', 'push'].includes(wager.status)) return false
        if (!wager.resolvedAt) return false
        const resolved = new Date(wager.resolvedAt)
        resolved.setHours(0, 0, 0, 0)
        return resolved.getTime() === today.getTime()
      }

      return [
        ...(user.bets || []).map((wager) => ({ wager, isParlay: false })),
        ...(user.parlays || []).map((wager) => ({ wager, isParlay: true }))
      ]
        .filter((item) => isSettledToday(item.wager))
        .map((item) => ({ ...item, key: `${item.isParlay ? 'p' : 'b'}-${item.wager._id}` }))
        .sort((a, b) => new Date(b.wager.resolvedAt) - new Date(a.wager.resolvedAt))
    })

    // A push returns the stake, so it moves neither figure.
    const net = computed(() =>
      settledToday.value.reduce((total, { wager }) => {
        if (wager.status === 'won') return total + (wager.potentialWin || 0)
        if (wager.status === 'lost') return total - (wager.amount || 0)
        return total
      }, 0)
    )

    const staked = computed(() =>
      settledToday.value.reduce((total, { wager }) => total + (wager.amount || 0), 0)
    )

    const returned = computed(() =>
      settledToday.value.reduce((total, { wager }) => {
        if (wager.status === 'won') return total + (wager.amount || 0) + (wager.potentialWin || 0)
        if (wager.status === 'push') return total + (wager.amount || 0)
        return total
      }, 0)
    )

    const record = computed(() => {
      const tally = { won: 0, lost: 0, push: 0 }
      for (const { wager } of settledToday.value) tally[wager.status] += 1
      // Pushes only earn a place in the record when there are some.
      return tally.push > 0
        ? `${tally.won}-${tally.lost}-${tally.push}`
        : `${tally.won}-${tally.lost}`
    })

    const netLabel = computed(() => {
      const value = net.value
      const sign = value > 0 ? '+' : value < 0 ? '−' : ''
      return `${sign}$${Math.abs(value).toLocaleString()}`
    })

    const netClass = computed(() => {
      if (net.value > 0) return 'positive'
      if (net.value < 0) return 'negative'
      return ''
    })

    return {
      isAuthenticated,
      settledToday,
      net,
      netLabel,
      netClass,
      record,
      staked,
      returned
    }
  }
}
</script>

<style scoped>
.today-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Same rule-divided strip as the ledger band above it, so the two read as one
   system rather than two ideas about how to show figures. */
.tr-summary {
  display: flex;
  align-items: stretch;
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border-strong);
}

.tr-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-4) clamp(var(--space-3), 1.4vw, var(--space-5));
  border-left: 1px solid var(--color-border-strong);
  flex: 1 1 0;
  min-width: 0;
  max-width: 220px;
}

.tr-cell-net {
  flex: 0 1 240px;
  padding-left: 0;
  border-left: none;
}

.tr-net {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 3.2vw, 2.5rem);
  font-weight: var(--display-weight);
  line-height: 1;
  color: var(--color-text);
}

.tr-net.positive { color: var(--color-success); }
.tr-net.negative { color: var(--color-danger); }

.tr-value {
  font-size: clamp(1.0625rem, 1.9vw, var(--text-2xl));
  font-weight: 500;
  line-height: 1.1;
  color: var(--color-text);
}

.tr-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (max-width: 560px) {
  .tr-summary {
    flex-wrap: wrap;
  }

  .tr-cell {
    max-width: none;
    flex: 1 1 45%;
  }
}
</style>
