<template>
  <div class="betting-interface" v-if="isAuthenticated && betting && gameScheduled">
    <h4 class="betting-title">Place Your Bet</h4>
    
    <div class="bet-options">
      <!-- Spread Betting -->
      <div class="bet-type" v-if="betting.pointSpread">
        <h5>Point Spread</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in spreadOptions" 
            :key="index"
            @click="selectBet('spread', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'spread' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.team }}</div>
            <div class="bet-line">{{ option.line }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>

      <!-- Moneyline Betting -->
      <div class="bet-type" v-if="betting.moneyline">
        <h5>Moneyline</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in moneylineOptions" 
            :key="index"
            @click="selectBet('moneyline', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'moneyline' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.team }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>

      <!-- Total (Over/Under) Betting -->
      <div class="bet-type" v-if="betting.total">
        <h5>Total Points</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in totalOptions" 
            :key="index"
            @click="selectBet('total', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'total' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.selection }}</div>
            <div class="bet-line">{{ option.line }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- Add the current pick to the parlay slip -->
    <div class="parlay-add-row" v-if="selectedBet">
      <button @click="addToParlay" class="add-parlay-btn" :class="{ 'in-slip': inSlip }">
        <span class="add-parlay-icon">{{ inSlip ? '✓' : '+' }}</span>
        {{ inSlip ? 'In your parlay slip' : 'Add to parlay' }}
      </button>
      <span v-if="parlayNote" class="parlay-note">{{ parlayNote }}</span>
    </div>

    <!-- Bet Amount Selection -->
    <div class="bet-amount" v-if="selectedBet">
      <h5>Bet Amount</h5>
      <div class="amount-input-group">
        <span class="currency-symbol">$</span>
        <input 
          v-model.number="betAmount" 
          type="number" 
          min="1" 
          :max="userBalance"
          step="1"
          class="amount-input"
          placeholder="Enter amount"
        />
      </div>
      
      <!-- Quick amount buttons -->
      <div class="quick-amounts">
        <button 
          v-for="amount in quickAmounts" 
          :key="amount"
          @click="betAmount = amount"
          :disabled="amount > userBalance"
          class="quick-amount-btn"
        >
          ${{ amount }}
        </button>
      </div>

      <!-- Bet Summary -->
      <div class="bet-summary" v-if="betAmount > 0">
        <div class="summary-row">
          <span>Bet Amount:</span>
          <span>${{ betAmount.toLocaleString() }}</span>
        </div>
        <div class="summary-row">
          <span>Potential Win:</span>
          <span class="potential-win">${{ potentialWin.toLocaleString() }}</span>
        </div>
        <div class="summary-row">
          <span>Total Return:</span>
          <span class="total-return">${{ (betAmount + potentialWin).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Place Bet Button -->
      <button 
        @click="placeBet"
        :disabled="!canPlaceBet || isPlacingBet"
        class="place-bet-btn"
      >
        <span v-if="isPlacingBet">Placing Bet...</span>
        <span v-else>Place Bet</span>
      </button>
    </div>
    
    <!-- Messages displayed outside conditional block so they persist after form reset -->
    <div v-if="error" class="message-container error-message">
      <span class="message-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>
    <div v-if="success" class="message-container success-message">
      <span class="message-icon">✓</span>
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
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  margin-top: 1rem;
}

.betting-title {
  margin: 0 0 1.5rem 0;
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 700;
}


.bet-type {
  margin-bottom: 2rem;
}

.bet-type h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: var(--text-base);
  font-weight: 600;
}

.bet-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.bet-option {
  background: white;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.bet-option:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.bet-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.bet-team {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.bet-line {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
}

.bet-odds {
  font-weight: 700;
  color: var(--color-success);
  font-size: var(--text-lg);
}

.bet-amount {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.bet-amount h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: var(--text-base);
  font-weight: 600;
}

.amount-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.currency-symbol {
  font-size: var(--text-xl);
  font-weight: 600;
  color: #374151;
  margin-right: 0.5rem;
}

.amount-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-lg);
  font-weight: 600;
}

.amount-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.quick-amounts {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.quick-amount-btn {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-amount-btn:hover:not(:disabled) {
  background: var(--color-border);
  border-color: var(--color-text-subtle);
}

.quick-amount-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-summary {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.summary-row:last-child {
  margin-bottom: 0;
  font-weight: 600;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.potential-win {
  color: var(--color-success);
  font-weight: 600;
}

.total-return {
  color: var(--color-primary);
  font-weight: 700;
}

.place-bet-btn {
  width: 100%;
  padding: 1rem;
  background: var(--color-success);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-lg);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.place-bet-btn:hover:not(:disabled) {
  background: #047857;
}

.place-bet-btn:disabled {
  background: var(--color-text-subtle);
  cursor: not-allowed;
}

.message-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  margin-top: 1rem;
  font-weight: 500;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-message {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: var(--color-danger);
}

.success-message {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: var(--color-success);
}

.message-icon {
  font-size: var(--text-xl);
  font-weight: 700;
}

@media (max-width: 768px) {
  .bet-options-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-amounts {
    justify-content: center;
  }
}

.parlay-add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.add-parlay-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: var(--color-surface);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-weight: 600;
  font-size: var(--text-sm);
  font-family: inherit;
  cursor: pointer;
}

.add-parlay-btn:hover { background: var(--color-primary-soft); }

.add-parlay-btn.in-slip {
  border-style: solid;
  background: var(--color-primary-soft);
}

.add-parlay-icon { font-weight: 700; }

.parlay-note {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
