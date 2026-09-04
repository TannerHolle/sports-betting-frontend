<template>
  <div class="parlay-card" :class="parlay.status === 'pending' ? 'active' : parlay.status">
    <div v-if="user" class="pc-username">{{ user.username }}</div>

    <div class="pc-header">
      <div class="pc-title">
        <h4>
          {{ parlay.legs.length }}-leg parlay
          <span class="pc-odds">{{ parlay.odds }}</span>
        </h4>
        <span class="pc-date">Placed {{ formatDate(parlay.createdAt) }}</span>
      </div>
      <div class="pc-status" :class="parlay.status">{{ statusLabel(parlay.status) }}</div>
    </div>

    <div class="pc-legs">
      <div v-for="(leg, i) in parlay.legs" :key="i" class="pc-leg" :class="leg.status">
        <span class="pc-dot" :class="leg.status"></span>
        <div class="pc-leg-body">
          <div class="pc-leg-pick">
            {{ leg.selection }}
            <span v-if="leg.line" class="pc-leg-line">{{ displayLine(leg) }}</span>
            <span class="pc-leg-odds">{{ leg.odds }}</span>
          </div>
          <div class="pc-leg-game">{{ gameLabel(leg) }}</div>
        </div>
      </div>
    </div>

    <div class="pc-footer">
      <div class="pc-figure">
        <span class="pc-figure-label">Wager</span>
        <span class="pc-figure-value">${{ parlay.amount.toLocaleString() }}</span>
      </div>
      <div class="pc-figure">
        <span class="pc-figure-label">{{ parlay.status === 'won' ? 'Won' : 'To win' }}</span>
        <span class="pc-figure-value payout">${{ parlay.potentialWin.toLocaleString() }}</span>
      </div>
      <div class="pc-figure" v-if="parlay.status === 'pending'">
        <span class="pc-figure-label">Legs hit</span>
        <span class="pc-figure-value">{{ wonLegs }}/{{ parlay.legs.length }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { formatLine } from '../utils/oddsMath.js'
import { computed } from 'vue'

export default {
  name: 'ParlayCard',
  props: {
    parlay: { type: Object, required: true },
    user: { type: Object, default: null }
  },
  setup(props) {
    const wonLegs = computed(() => props.parlay.legs.filter(l => l.status === 'won').length)

    const statusLabel = (s) => ({ pending: 'Open', won: 'Won', lost: 'Lost', push: 'Push' }[s] || s)

    const gameLabel = (leg) =>
      leg.gameData?.gameName?.replace(' at ', ' @ ') ||
      (leg.gameData?.awayTeam && leg.gameData?.homeTeam
        ? `${leg.gameData.awayTeam} @ ${leg.gameData.homeTeam}`
        : leg.sport || '')


    const formatDate = (value) => {
      if (!value) return ''
      return new Date(value).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    }

    return { wonLegs, statusLabel, gameLabel, displayLine: formatLine, formatDate }
  }
}
</script>

<style scoped>
.parlay-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.parlay-card.won { border-left-color: var(--color-success); }
.parlay-card.lost { border-left-color: var(--color-danger); }
.parlay-card.push { border-left-color: var(--color-warning); }
.parlay-card.active { border-left-color: var(--color-primary); }

.pc-username {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.pc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.pc-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.pc-title h4 {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

.pc-odds {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-success);
  font-variant-numeric: tabular-nums;
}

.pc-date {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.pc-status {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  flex: 0 0 auto;
}

.pc-status.won { background: var(--color-success-soft); color: var(--color-success); }
.pc-status.lost { background: var(--color-danger-soft); color: var(--color-danger); }
.pc-status.push { background: var(--color-warning-soft); color: var(--color-warning); }
.pc-status.pending { background: var(--color-primary-soft); color: var(--color-primary); }

/* ── Legs ── */
.pc-legs {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pc-leg {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.pc-dot {
  display: block;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex: 0 0 auto;
}

.pc-dot.won { background: var(--color-success); }
.pc-dot.lost { background: var(--color-danger); }
.pc-dot.push { background: var(--color-warning); }

.pc-leg-body {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pc-leg-pick {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
}

.pc-leg-line,
.pc-leg-odds {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.pc-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* ── Footer figures ── */
.pc-footer {
  display: flex;
  gap: var(--space-5);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.pc-figure {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1 1 0;
  min-width: 0;
}

.pc-figure-label {
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.pc-figure-value {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.pc-figure-value.payout { color: var(--color-success); }
</style>
