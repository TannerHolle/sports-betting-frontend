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

    const displayLine = (leg) => {
      if (!leg.line) return ''
      if (leg.betType === 'total') return `${leg.selection === 'Over' ? 'o' : 'u'}${leg.line}`
      const n = parseFloat(leg.line)
      return Number.isNaN(n) ? leg.line : (n > 0 ? `+${n}` : `${n}`)
    }

    const formatDate = (value) => {
      if (!value) return ''
      return new Date(value).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    }

    return { wonLegs, statusLabel, gameLabel, displayLine, formatDate }
  }
}
</script>

<style scoped>
.parlay-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--color-text-subtle);
}
.parlay-card.active { border-left-color: var(--color-success); }
.parlay-card.won { border-left-color: var(--color-success); }
.parlay-card.lost { border-left-color: var(--color-danger); }
.parlay-card.push { border-left-color: var(--color-warning); }

.pc-username {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.pc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.pc-title h4 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.pc-odds { color: var(--color-success); font-variant-numeric: tabular-nums; }
.pc-date { font-size: var(--text-xs); color: var(--color-text-subtle); }

.pc-status {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
.pc-status.pending { background: var(--color-primary-soft); color: var(--color-primary); }
.pc-status.won { background: var(--color-success-soft); color: var(--color-success); }
.pc-status.lost { background: #fef2f2; color: var(--color-danger); }
.pc-status.push { background: #fffbeb; color: #92400e; }

.pc-legs {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 0.25rem 0;
  margin-bottom: 0.75rem;
}
.pc-leg { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0; }
.pc-leg + .pc-leg { border-top: 1px dashed var(--color-border); }

.pc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pc-dot.pending { background: var(--color-text-subtle); }
.pc-dot.won { background: var(--color-success); }
.pc-dot.lost { background: var(--color-danger); }
.pc-dot.push { background: var(--color-warning); }

.pc-leg-body { flex: 1; min-width: 0; }
.pc-leg-pick { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.pc-leg-line { color: var(--color-text-muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.pc-leg-odds { color: var(--color-success); margin-left: 6px; font-variant-numeric: tabular-nums; }
.pc-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.pc-footer { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.pc-figure { display: flex; flex-direction: column; gap: 2px; }
.pc-figure-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.pc-figure-value {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.pc-figure-value.payout { color: var(--color-success); }

@media (max-width: 768px) {
  .parlay-card { padding: 1rem; }
  .pc-header { flex-direction: column; }
}
</style>
