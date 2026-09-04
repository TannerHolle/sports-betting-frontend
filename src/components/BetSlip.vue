<template>
  <div v-if="legCount > 0" class="bet-slip" :class="{ open: isOpen }">
    <button class="slip-handle" @click="isOpen = !isOpen">
      <span class="slip-badge">{{ legCount }}</span>
      <span class="slip-handle-text">
        {{ legCount }}-leg parlay
        <span v-if="legCount >= minLegs" class="slip-handle-odds">{{ combinedOdds }}</span>
      </span>
      <span class="slip-chevron" :class="{ open: isOpen }"><svg class="icon-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
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
import { formatAmerican, formatLine } from '../utils/oddsMath.js'

export default {
  name: 'BetSlip',
  setup() {
    const slip = useBetSlip()
    const error = ref('')
    const success = ref('')
    const placing = ref(false)
    const quickAmounts = [10, 25, 50, 100]

    const legKey = (leg) => `${leg.gameId}:${leg.betType}:${leg.selection}:${leg.line ?? ''}`


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

    return { ...slip, error, success, placing, quickAmounts, legKey, displayLine: formatLine, onStake, submit, formatAmerican }
  }
}
</script>

<style scoped>
/* The slip is the one element that genuinely floats, so it keeps a shadow
   where the rest of the redesign uses rules. Comments about sitting on a blue
   gradient no longer apply — the page is paper now. */
.bet-slip {
  /* ChatWidget owns the bottom-right corner (z-index 1000), so the slip lives
     on the left. On mobile the chat widget is hidden and this goes full width. */
  position: fixed;
  left: var(--space-6);
  bottom: 0;
  width: 360px;
  max-width: calc(100vw - var(--space-12));
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  box-shadow: var(--shadow-lg);
  z-index: 900;
  overflow: hidden;
}

/* ── Handle ── */
.slip-handle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-text);
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.slip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
}

.slip-handle-text {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-bg);
}

.slip-handle-odds {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-success-light);
  font-variant-numeric: tabular-nums;
}

.slip-chevron {
  display: inline-flex;
  color: var(--color-text-muted);
}

.slip-chevron .icon-chevron { transition: transform 0.16s ease; }
.slip-chevron.open .icon-chevron { transform: rotate(180deg); }

/* the slip is anchored to the bottom of the viewport, so the whole panel needs
   a ceiling — not just the legs list — or a long parlay pushes the Place button
   off screen on a short window */
.slip-body {
  max-height: 82vh;
  overflow-y: auto;
}

/* ── Legs ── */
.slip-legs {
  display: flex;
  flex-direction: column;
  max-height: 40vh;
  overflow-y: auto;
}

.slip-leg {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.slip-leg-main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slip-leg-pick {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

.slip-leg-line {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.slip-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.slip-leg-odds {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
}

.slip-leg-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  font-size: var(--text-lg);
  line-height: 1;
  cursor: pointer;
  flex: 0 0 auto;
}

.slip-leg-remove:hover {
  background: var(--color-surface-muted);
  color: var(--color-danger);
}

.slip-hint {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}

/* ── Stake ── */
.slip-stake {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.slip-stake label {
  font-size: var(--label-size);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  flex: 0 0 auto;
}

.slip-amount-wrap {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 42px;
  padding: 0 var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.slip-amount-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.slip-currency {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  color: var(--color-text-subtle);
}

.slip-amount-input {
  flex: 1 1 0;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}

.slip-amount-input::-webkit-outer-spin-button,
.slip-amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.slip-quick {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1);
  padding: 0 var(--space-4) var(--space-4);
}

.slip-quick-btn {
  height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.slip-quick-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.slip-quick-btn.active {
  background: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-text-inverse);
}

/* ── Summary ── */
.slip-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-muted);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.slip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

.slip-row strong {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.slip-row .slip-payout {
  font-size: var(--text-3xl);
  font-weight: 500;
  line-height: 1;
  color: var(--color-success);
}

/* ── Actions ── */
.slip-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4);
}

.slip-clear {
  height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  flex: 0 0 auto;
}

.slip-clear:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.slip-place {
  flex: 1 1 0;
  height: 44px;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-inverse);
  cursor: pointer;
}

.slip-place:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.slip-place:disabled,
.slip-clear:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slip-error,
.slip-success {
  margin: 0;
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}

.slip-error { color: var(--color-danger); background: var(--color-danger-soft); }
.slip-success { color: var(--color-success); background: var(--color-success-soft); }

@media (max-width: 720px) {
  .bet-slip {
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    border-left: none;
    border-right: none;
    border-radius: 0;
  }
}
</style>
