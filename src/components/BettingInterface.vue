<template>
  <div
    class="betting-interface"
    :class="[layout, { readonly: isReadonly }]"
    v-if="isAuthenticated && betting && (gameScheduled || layout === 'board')"
  >
    <div class="bi-head" v-if="layout === 'card'">
      <h4 class="bi-title">Place a bet</h4>
      <span class="bi-note">Lines close at kickoff</span>
    </div>

    <!-- One grid, three markets. Rows are away-then-home so a column reads
         straight down the way a printed sheet does; the three markets used to
         be separate stacked sections with their own headings. -->
    <div class="markets">
      <div class="market-heads" v-if="layout === 'card'">
        <span class="market-head">Point spread</span>
        <span class="market-head">Moneyline</span>
        <span class="market-head">Total points</span>
      </div>

      <div class="market-row" v-for="(row, rowIndex) in marketRows" :key="rowIndex">
        <button
          v-for="cell in row"
          :key="cell.type"
          class="odds-cell"
          :class="{ selected: isCellSelected(cell) }"
          :disabled="!cell.option || isReadonly"
          @click="!isReadonly && cell.option && selectBet(cell.type, cell.option)"
        >
          <span class="odds-cell-main">
            <span class="odds-cell-label">{{ cell.label }}</span>
            <span class="odds-cell-line">{{ cellLine(cell) }}</span>
          </span>
          <span class="odds-cell-price">{{ cellPrice(cell) }}</span>
        </button>
      </div>
    </div>

    <!-- Stake and actions share a wrapper so the board can put them on one
         line when there is room; the card layout keeps them stacked. -->
    <div class="bi-footer" v-if="selectedBet && !isReadonly">
      <div class="stake">
      <div class="stake-field">
        <span class="eyebrow">Wager</span>
        <div class="amount-input-group">
          <span class="currency-symbol">$</span>
          <input
            v-model.number="betAmount"
            type="number"
            min="1"
            :max="userBalance"
            step="1"
            class="amount-input"
            placeholder="0"
          />
        </div>
      </div>

      <div class="stake-field">
        <span class="eyebrow">Quick</span>
        <div class="quick-amounts">
          <button
            v-for="amount in quickAmounts"
            :key="amount"
            @click="betAmount = amount"
            :disabled="amount > userBalance"
            class="quick-amount-btn"
            :class="{ active: betAmount === amount }"
          >
            ${{ amount }}
          </button>
        </div>
      </div>

      <div class="stake-summary" v-if="betAmount > 0">
        <div class="summary-row">
          <span>{{ selectionLabel }}</span>
          <span class="figure">${{ betAmount.toLocaleString() }}</span>
        </div>
        <div class="summary-row">
          <span>Potential win</span>
          <span class="figure potential-win">${{ potentialWin.toLocaleString() }}</span>
        </div>
        <div class="summary-row total">
          <span>Total return</span>
          <span class="figure total-return">${{ (betAmount + potentialWin).toLocaleString() }}</span>
        </div>
        </div>
      </div>

      <div class="bi-actions">
      <button @click="addToParlay" class="add-parlay-btn" :class="{ 'in-slip': inSlip }">
        <span class="add-parlay-icon">
          <svg v-if="inSlip" width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </span>
        {{ inSlip ? 'In your parlay slip' : 'Add to parlay' }}
      </button>

      <button
        @click="placeBet"
        :disabled="!canPlaceBet || isPlacingBet"
        class="place-bet-btn"
      >
        <span v-if="isPlacingBet">Placing bet…</span>
        <span v-else-if="betAmount > 0">Place bet &mdash; ${{ betAmount.toLocaleString() }} to win ${{ potentialWin.toLocaleString() }}</span>
        <span v-else>Place bet</span>
      </button>
      </div>
    </div>

    <p v-if="parlayNote" class="parlay-note">{{ parlayNote }}</p>

    <!-- Messages displayed outside conditional block so they persist after form reset -->
    <div v-if="error" class="message-container error-message">
      <span class="message-icon"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.75L14.75 13.5H1.25L8 1.75Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.25v3M8 11.4h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
      <span>{{ error }}</span>
    </div>
    <div v-if="success" class="message-container success-message">
      <span class="message-icon"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span>{{ success }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import { useBetSlip } from '../stores/betSlipStore.js'
import { convertToLocalTime, formatRelativeTime } from '../utils/timezoneUtils.js'

export default {
  name: 'BettingInterface',
  props: {
    game: {
      type: Object,
      required: true
    },
    layout: {
      type: String,
      default: 'card',
      validator: (v) => ['card', 'board'].includes(v)
    },
    betting: {
      type: Object,
      required: true
    },
    sport: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const userStore = useUserStore()
    const betSlip = useBetSlip()
    const selectedBet = ref(null)
    const parlayNote = ref('')
    const betAmount = ref(0)
    const error = ref('')
    const success = ref('')
    const isPlacingBet = ref(false)
    
    const quickAmounts = [10, 25, 50, 100, 250, 500]

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const userBalance = computed(() => userStore.userBalance.value)

    // Get team names
    const homeTeam = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')
      return competitor?.team?.shortDisplayName || 'Home'
    })

    const awayTeam = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')
      return competitor?.team?.shortDisplayName || 'Away'
    })

    // Game status and scores for live data
    const gameInProgress = computed(() => {
      const status = props.game.competitions?.[0]?.status
      return status?.type?.state === 'in'
    })

    // Check if game is scheduled (not started yet)
    const gameScheduled = computed(() => {
      const status = props.game.competitions?.[0]?.status
      return status?.type?.state === 'pre' && !status?.type?.completed
    })

    const homeScore = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')
      return competitor?.score || '0'
    })

    const awayScore = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')
      return competitor?.score || '0'
    })

    const statusText = computed(() => {
      const status = props.game.competitions?.[0]?.status
      if (status?.type?.completed) return 'Final'
      if (status?.type?.state === 'in') {
        return `${status.displayClock} - ${status.period}${getOrdinalSuffix(status.period)}`
      }
      // Convert scheduled game time to user's local timezone
      const shortDetail = status?.type?.shortDetail
      if (shortDetail && shortDetail.includes('PM') || shortDetail?.includes('AM')) {
        return formatRelativeTime(shortDetail)
      }
      return shortDetail || 'Scheduled'
    })

    const getOrdinalSuffix = (num) => {
      if (num >= 11 && num <= 13) return 'th'
      switch (num % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }

    // Spread options
    const spreadOptions = computed(() => {
      if (!props.betting.pointSpread) return []
      
      const homeLine = parseFloat(props.betting.pointSpread.home.close.line)
      const awayLine = parseFloat(props.betting.pointSpread.away.close.line)
      
      return [
        {
          team: homeLine < 0 ? homeTeam.value : awayTeam.value,
          line: homeLine < 0 ? homeLine : awayLine,
          odds: homeLine < 0 ? props.betting.pointSpread.home.close.odds : props.betting.pointSpread.away.close.odds,
          selection: homeLine < 0 ? homeTeam.value : awayTeam.value
        },
        {
          team: homeLine < 0 ? awayTeam.value : homeTeam.value,
          line: homeLine < 0 ? awayLine : homeLine,
          odds: homeLine < 0 ? props.betting.pointSpread.away.close.odds : props.betting.pointSpread.home.close.odds,
          selection: homeLine < 0 ? awayTeam.value : homeTeam.value
        }
      ]
    })

    // Moneyline options
    const moneylineOptions = computed(() => {
      if (!props.betting.moneyline) return []
      
      return [
        {
          team: homeTeam.value,
          odds: props.betting.moneyline.home.close.odds,
          selection: homeTeam.value
        },
        {
          team: awayTeam.value,
          odds: props.betting.moneyline.away.close.odds,
          selection: awayTeam.value
        }
      ]
    })

    // Total options
    const totalOptions = computed(() => {
      if (!props.betting.total) return []
      
      return [
        {
          selection: 'Over',
          line: props.betting.total.over.close.line,
          odds: props.betting.total.over.close.odds
        },
        {
          selection: 'Under',
          line: props.betting.total.under.close.line,
          odds: props.betting.total.under.close.odds
        }
      ]
    })

    // Calculate potential winnings
    const potentialWin = computed(() => {
      if (!selectedBet.value || !betAmount.value) return 0
      
      let odds = selectedBet.value.odds
      const amount = betAmount.value
      
      // Convert number odds to string format if needed
      if (typeof odds === 'number') {
        odds = odds > 0 ? `+${odds}` : `${odds}`
      }
      
      // Handle "EVEN" odds (which means +100)
      if (odds === 'EVEN' || odds === 'even') {
        return amount // Even odds means you win the same amount you bet
      }
      
      // Parse odds (e.g., "+150" or "-200")
      const isPositive = odds.startsWith('+')
      const oddsValue = parseInt(odds.replace(/[+-]/, ''))
      
      // Check if oddsValue is valid
      if (isNaN(oddsValue)) {
        return 0
      }
      
      if (isPositive) {
        // Positive odds: win = (amount * odds) / 100
        return Math.round((amount * oddsValue) / 100)
      } else {
        // Negative odds: win = (amount * 100) / odds
        return Math.round((amount * 100) / oddsValue)
      }
    })

    const canPlaceBet = computed(() => {
      return selectedBet.value && 
             betAmount.value > 0 && 
             betAmount.value <= userBalance.value &&
             !error.value &&
             !isPlacingBet.value &&
             gameScheduled.value
    })

    const selectBet = (type, option) => {
      selectedBet.value = {
        type,
        selection: option.selection,
        odds: option.odds,
        line: option.line,
        team: option.team
      }
      error.value = ''
      success.value = ''
    }

    const placeBet = async () => {
      if (!canPlaceBet.value || isPlacingBet.value || !gameScheduled.value) return
      
      isPlacingBet.value = true
      error.value = ''
      
      // Get game start time from game data
      const competition = props.game.competitions?.[0]
      const status = competition?.status
      const gameStartTime = props.game.date || competition?.date
      const gameStartTimeFormatted = status?.type?.shortDetail || null

      const betData = {
        gameId: props.game.id,
        betType: selectedBet.value.type,
        selection: selectedBet.value.selection,
        amount: betAmount.value,
        odds: selectedBet.value.odds,
        line: selectedBet.value.line, // Include the line (spread or total)
        potentialWin: potentialWin.value,
        sport: props.sport, // Include the sport
        gameData: {
          homeTeam: homeTeam.value,
          awayTeam: awayTeam.value,
          gameName: props.game.name,
          gameStartTime: gameStartTime,
          gameStartTimeFormatted: gameStartTimeFormatted
        }
      }
      
      try {
        const result = await userStore.placeBet(betData)
        
        if (result.success) {
          success.value = `Bet placed successfully! Potential win: $${potentialWin.value.toLocaleString()}`
          // Reset form
          selectedBet.value = null
          betAmount.value = 0
          error.value = ''
          
          // Clear success message after 5 seconds
          setTimeout(() => {
            success.value = ''
          }, 5000)
        } else {
          error.value = result.error || 'Failed to place bet. Please try again.'
        }
      } catch (err) {
        error.value = err.response?.data?.error || 'An unexpected error occurred. Please try again.'
        console.error('Error placing bet:', err)
      } finally {
        isPlacingBet.value = false
      }
    }

    // Shape the current selection the way the slip and the API expect
    const currentLeg = () => {
      if (!selectedBet.value) return null
      const competition = props.game.competitions?.[0]
      return {
        gameId: props.game.id,
        betType: selectedBet.value.type,
        selection: selectedBet.value.selection,
        odds: selectedBet.value.odds,
        line: selectedBet.value.line ?? null,
        sport: props.sport,
        gameLabel: `${awayTeam.value} @ ${homeTeam.value}`,
        gameData: {
          homeTeam: homeTeam.value,
          awayTeam: awayTeam.value,
          gameName: props.game.name,
          gameStartTime: props.game.date || competition?.date,
          gameStartTimeFormatted: competition?.status?.type?.shortDetail || null
        }
      }
    }

    // The three option lists are ordered differently (spread by favourite,
    // moneyline by home/away, total by over/under), so they cannot be zipped
    // as-is. Re-key them onto away-then-home rows so each column lines up.
    const marketRows = computed(() => {
      const spreadFor = (team) => spreadOptions.value.find((o) => o.selection === team)
      const moneylineFor = (team) => moneylineOptions.value.find((o) => o.selection === team)
      const totalFor = (side) => totalOptions.value.find((o) => o.selection === side)

      const row = (team, side) => ([
        { type: 'spread', label: team, option: spreadFor(team) },
        { type: 'moneyline', label: team, option: moneylineFor(team) },
        { type: 'total', label: side, option: totalFor(side) }
      ])

      return [row(awayTeam.value, 'Over'), row(homeTeam.value, 'Under')]
    })

    // Lines are frozen once a game starts — placeBet() already refuses, this
    // just stops the board offering a control that cannot be used.
    const isReadonly = computed(() => !gameScheduled.value)

    // "Bears -3.5 (-110)" rather than just "Bears -110"
    const selectionLabel = computed(() => {
      const bet = selectedBet.value
      if (!bet) return ''
      const odds = formatOdds(bet.odds)
      const line = parseFloat(bet.line)
      if (Number.isNaN(line)) return `${bet.selection} (${odds})`
      if (bet.type === 'total') return `${bet.selection} ${Math.abs(line)} (${odds})`
      return `${bet.selection} ${line > 0 ? '+' : ''}${line} (${odds})`
    })

    const isCellSelected = (cell) =>
      !!cell.option &&
      selectedBet.value?.type === cell.type &&
      selectedBet.value?.selection === cell.option.selection

    const cellLine = (cell) => {
      if (!cell.option) return '—'
      if (cell.type === 'moneyline') return formatOdds(cell.option.odds)
      const line = parseFloat(cell.option.line)
      if (Number.isNaN(line)) return cell.option.line ?? '—'
      if (cell.type === 'total') return `${cell.option.selection === 'Over' ? 'o' : 'u'}${Math.abs(line)}`
      return line > 0 ? `+${line}` : `${line}`
    }

    // Moneyline puts its price in the main slot, so it has nothing left here
    const cellPrice = (cell) => {
      if (!cell.option || cell.type === 'moneyline') return ''
      return formatOdds(cell.option.odds)
    }

    const formatOdds = (odds) => {
      if (odds === null || odds === undefined || odds === '') return ''
      const n = parseFloat(odds)
      if (Number.isNaN(n)) return String(odds)
      return n > 0 ? `+${n}` : `${n}`
    }

    const inSlip = computed(() => {
      const leg = currentLeg()
      return leg ? betSlip.hasLeg(leg) : false
    })

    const addToParlay = () => {
      const leg = currentLeg()
      if (!leg) return
      parlayNote.value = ''
      const result = betSlip.addLeg(leg)
      if (!result.success) {
        parlayNote.value = result.error
      } else if (result.removed) {
        parlayNote.value = 'Removed from slip'
        setTimeout(() => { parlayNote.value = '' }, 2500)
      }
    }

    return {
      marketRows,
      isReadonly,
      selectionLabel,
      isCellSelected,
      cellLine,
      cellPrice,
      selectedBet,
      betAmount,
      addToParlay,
      inSlip,
      parlayNote,
      error,
      success,
      quickAmounts,
      isAuthenticated,
      userBalance,
      spreadOptions,
      moneylineOptions,
      totalOptions,
      potentialWin,
      canPlaceBet,
      isPlacingBet,
      gameScheduled,
      selectBet,
      placeBet
    }
  }
}
</script>

<style scoped>
.betting-interface {
  padding: var(--space-4) var(--space-5) var(--space-5);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.bi-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
}

.bi-title {
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

.bi-note {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* ── Odds grid ── */
.markets {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.market-heads,
.market-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.market-head {
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.odds-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  height: 46px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.odds-cell:hover:not(:disabled) {
  border-color: var(--color-text-subtle);
  background: var(--color-surface-muted);
}

.odds-cell:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.odds-cell.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.odds-cell-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.odds-cell-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.odds-cell-line {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.odds-cell-price {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
}

.odds-cell.selected .odds-cell-label,
.odds-cell.selected .odds-cell-line,
.odds-cell.selected .odds-cell-price {
  color: var(--color-primary);
}

/* ── Stake ── */
/* Card layout: a plain block, so .stake and .bi-actions stack exactly as before */
.bi-footer {
  display: block;
}

.stake {
  display: flex;
  align-items: flex-end;
  gap: var(--space-5);
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.stake-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 0 0 auto;
}

.amount-input-group {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 128px;
  height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.amount-input-group:focus-within {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.currency-symbol {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  color: var(--color-text-subtle);
}

.amount-input {
  flex: 1 1 0;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}

.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quick-amounts {
  display: flex;
  gap: var(--space-1);
}

.quick-amount-btn {
  height: 40px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.quick-amount-btn:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.quick-amount-btn.active {
  background: var(--color-text);
  border-color: var(--color-text);
  color: var(--color-text-inverse);
}

.quick-amount-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stake-summary {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-border-strong);
}

.summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.summary-row .figure {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.summary-row .potential-win { color: var(--color-success); }

.summary-row.total {
  padding-top: var(--space-1);
  margin-top: var(--space-1);
  border-top: 1px solid var(--color-border-strong);
  color: var(--color-text);
  font-weight: 600;
}

.summary-row.total .figure,
.total-return {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text);
}

/* ── Actions ── */
.bi-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.add-parlay-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
}

.add-parlay-btn:hover { background: var(--color-surface-muted); }

.add-parlay-btn.in-slip {
  border-color: var(--color-success);
  color: var(--color-success);
}

.add-parlay-icon { display: inline-flex; align-items: center; }

.place-bet-btn {
  flex: 1 1 0;
  height: 44px;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--color-text-inverse);
  cursor: pointer;
}

.place-bet-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.place-bet-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.parlay-note {
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* ── Messages ── */
.message-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.message-icon { display: inline-flex; align-items: center; }

.error-message {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.success-message {
  background: var(--color-success-soft);
  color: var(--color-success);
}

/* ── Board layout ──
   display:contents dissolves this wrapper so .markets, .stake and .bi-actions
   become direct children of GameBoardRow's grid: the odds land in column 2
   beside the matchup, and the stake bar spans the full width beneath. */
.betting-interface.board {
  display: contents;
}

.betting-interface.board .markets {
  grid-column: 2;
  gap: var(--space-1);
  padding-top: 0;
}

.betting-interface.board .market-row {
  gap: var(--space-2);
}

.betting-interface.board .odds-cell {
  height: 38px;
  padding: 0 var(--space-2);
}

.betting-interface.board .odds-cell-label {
  font-size: 10px;
  line-height: 1.2;
}

.betting-interface.board .odds-cell-line { font-size: var(--text-base); }
.betting-interface.board .odds-cell-price { font-size: var(--text-xs); }

.betting-interface.board .parlay-note,
.betting-interface.board .message-container {
  grid-column: 1 / -1;
}

/* ── Board footer: one line when it fits ──
   The stake controls and the two buttons used to occupy two full-width rows
   under a selected game, which is a lot of vertical space on a wide board.
   Here the wrapper owns the panel and lays everything out in a single row;
   flex-wrap drops the buttons to their own line only when they stop fitting. */
.betting-interface.board .bi-footer {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-4);
  margin-top: var(--space-1);
  padding: var(--space-3);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

/* the panel moved to the wrapper, so the inner block is bare */
.betting-interface.board .stake {
  flex: 1 1 420px;
  margin-top: 0;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
  gap: var(--space-4);
}

.betting-interface.board .bi-actions {
  flex: 1 1 340px;
  margin-top: 0;
  gap: var(--space-2);
}

/* Let the label set the button's minimum. Squeezing it wraps "Place bet —
   $100 to win $95" onto two lines inside the button; better to drop the whole
   actions group to its own line, where there is room for it. */
.betting-interface.board .place-bet-btn {
  min-width: 190px;
  white-space: nowrap;
}

.betting-interface.board .add-parlay-btn {
  white-space: nowrap;
}

/* Keep the summary at a readable width. Without this it is the flex item that
   gives, so "Total return" wraps onto two lines while the row insists on
   staying single — better to let the buttons drop to their own line instead. */
.betting-interface.board .stake-summary {
  flex: 0 0 auto;
  min-width: 224px;
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-border-strong);
}

.betting-interface.board .summary-row > span {
  white-space: nowrap;
}

.betting-interface.board .stake-field {
  flex: 0 0 auto;
}

@media (max-width: 1000px) {
  .betting-interface.board .markets { grid-column: 1; }
}

/* a started game keeps its prices on the board, but inert */
.betting-interface.readonly .odds-cell {
  opacity: 0.55;
  cursor: default;
}

.betting-interface.readonly .odds-cell:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}

@media (max-width: 720px) {
  .market-heads { display: none; }

  .market-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .odds-cell { padding: 0 var(--space-2); }

  .stake {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .stake-summary {
    padding-left: 0;
    padding-top: var(--space-3);
    border-left: none;
    border-top: 1px solid var(--color-border-strong);
  }

  .bi-actions { flex-direction: column; }
}
</style>
