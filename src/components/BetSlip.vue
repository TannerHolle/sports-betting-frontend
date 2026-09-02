<template>
  <div v-if="legCount > 0" class="bet-slip" :class="{ open: isOpen }">
    <button class="slip-handle" @click="isOpen = !isOpen">
      <span class="slip-badge">{{ legCount }}</span>
      <span class="slip-handle-text">
        {{ legCount }}-leg parlay
        <span v-if="legCount >= minLegs" class="slip-handle-odds">{{ combinedOdds }}</span>
      </span>
      <span class="slip-chevron">{{ isOpen ? '▾' : '▴' }}</span>
    </button>

    <div v-show="isOpen" class="slip-body">
      <div class="slip-legs">
        <div v-for="leg in legs" :key="legKey(leg)" class="slip-leg">
          <div class="slip-leg-main">
            <div class="slip-leg-pick">
              {{ leg.selection }}
              <span v-if="leg.line" class="slip-leg-line">{{ displayLine(leg) }}</span>
            </div>
            <div class="slip-leg-game">{{ leg.gameLabel || leg.betType }}</div>
          </div>
          <div class="slip-leg-odds">{{ formatAmerican(leg.odds) }}</div>
          <button class="slip-leg-remove" @click="removeLeg(leg)" aria-label="Remove leg">×</button>
        </div>
      </div>

      <p v-if="legCount < minLegs" class="slip-hint">
        Add {{ minLegs - legCount }} more pick{{ minLegs - legCount === 1 ? '' : 's' }} to place a parlay.
      </p>

      <div class="slip-stake">
        <label for="slip-amount">Wager</label>
        <div class="slip-amount-wrap">
          <span class="slip-currency">$</span>
          <input
            id="slip-amount"
            :value="stake || ''"
            @input="onStake($event.target.value)"
            type="number" min="1" step="1" placeholder="0"
            class="slip-amount-input"
          />
        </div>
      </div>

      <div class="slip-quick">
        <button v-for="amount in quickAmounts" :key="amount"
                @click="setStake(amount)"
                class="slip-quick-btn" :class="{ active: stake === amount }">
          ${{ amount }}
        </button>
      </div>

      <div class="slip-summary">
        <div class="slip-row">
          <span>Odds</span>
          <strong>{{ combinedOdds }}</strong>
        </div>
        <div class="slip-row">
          <span>To win</span>
          <strong class="slip-payout">${{ potentialWin.toLocaleString() }}</strong>
        </div>
      </div>

      <p v-if="error" class="slip-error">{{ error }}</p>
      <p v-if="success" class="slip-success">{{ success }}</p>

      <div class="slip-actions">
        <button class="slip-clear" @click="clear" :disabled="placing">Clear</button>
        <button class="slip-place" @click="submit" :disabled="!canPlace || placing">
          {{ placing ? 'Placing…' : 'Place parlay' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useBetSlip } from '../stores/betSlipStore.js'
import { formatAmerican } from '../utils/oddsMath.js'

export default {
  name: 'BetSlip',
  setup() {
    const slip = useBetSlip()
    const error = ref('')
    const success = ref('')
    const placing = ref(false)
    const quickAmounts = [10, 25, 50, 100]

    const legKey = (leg) => `${leg.gameId}:${leg.betType}:${leg.selection}:${leg.line ?? ''}`

    const displayLine = (leg) => {
      if (!leg.line) return ''
      if (leg.betType === 'total') return `${leg.selection === 'Over' ? 'o' : 'u'}${leg.line}`
      const n = parseFloat(leg.line)
      return Number.isNaN(n) ? leg.line : (n > 0 ? `+${n}` : `${n}`)
    }

    const onStake = (value) => {
      slip.setStake(value)
      error.value = ''
    }

    const submit = async () => {
      placing.value = true
      error.value = ''
      success.value = ''
      const result = await slip.placeParlay()
      placing.value = false
      if (result.success) {
        success.value = 'Parlay placed!'
        setTimeout(() => { success.value = '' }, 4000)
      } else {
        error.value = result.error
      }
    }

    return { ...slip, error, success, placing, quickAmounts, legKey, displayLine, onStake, submit, formatAmerican }
  }
}
</script>

<style scoped>
.bet-slip {
  position: fixed;
  right: 24px;
  bottom: 0;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  z-index: 900;
  overflow: hidden;
}

.slip-handle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--gradient-brand);
  color: white;
  border: none;
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: 600;
}

.slip-badge {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  min-width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 700;
}

.slip-handle-text { flex: 1; text-align: left; }
.slip-handle-odds { opacity: 0.85; font-weight: 500; margin-left: 6px; }
.slip-chevron { opacity: 0.9; }

.slip-body {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.slip-legs { display: flex; flex-direction: column; gap: 8px; }

.slip-leg {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.slip-leg-main { flex: 1; min-width: 0; }
.slip-leg-pick {
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--text-sm);
}
.slip-leg-line { color: var(--color-text-muted); font-weight: 500; margin-left: 4px; }
.slip-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slip-leg-odds {
  font-weight: 700;
  color: var(--color-primary);
  font-size: var(--text-sm);
}
.slip-leg-remove {
  background: none;
  border: none;
  color: var(--color-text-subtle);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.slip-leg-remove:hover { color: var(--color-danger); }

.slip-hint {
  margin: 10px 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
}

.slip-stake { margin-top: 14px; }
.slip-stake label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.slip-amount-wrap { display: flex; align-items: center; }
.slip-currency {
  padding: 0 8px;
  color: var(--color-text-muted);
  font-weight: 600;
  border: 1px solid var(--color-border-strong);
  border-right: none;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  height: 40px;
  display: flex;
  align-items: center;
}
.slip-amount-input {
  flex: 1;
  height: 40px;
  border: 1px solid var(--color-border-strong);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  padding: 0 10px;
  font-size: var(--text-base);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  min-width: 0;
}
.slip-amount-input:focus { outline: none; border-color: var(--color-primary); box-shadow: var(--shadow-focus); }

.slip-quick { display: flex; gap: 6px; margin-top: 8px; }
.slip-quick-btn {
  flex: 1;
  padding: 7px 0;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.slip-quick-btn.active,
.slip-quick-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

.slip-summary {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.slip-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: 6px;
}
.slip-row strong { color: var(--color-text); font-variant-numeric: tabular-nums; }
.slip-payout { color: var(--color-success); }

.slip-error, .slip-success {
  margin: 10px 0 0;
  font-size: var(--text-xs);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}
.slip-error { background: #fef2f2; color: var(--color-danger); }
.slip-success { background: #ecfdf5; color: var(--color-success); }

.slip-actions { display: flex; gap: 8px; margin-top: 14px; }
.slip-clear {
  padding: 11px 14px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  cursor: pointer;
}
.slip-place {
  flex: 1;
  padding: 11px 14px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--text-sm);
  cursor: pointer;
}
.slip-place:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .bet-slip { right: 0; left: 0; width: 100%; max-width: 100%; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
  .slip-body { max-height: 55vh; }
}
</style>
