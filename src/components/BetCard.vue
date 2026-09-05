<template>
  <div 
    class="bet-card"
    :class="bet.status === 'pending' ? 'active' : bet.status"
  >
    <!-- Username for friends' bets (simple label at top) -->
    <div v-if="user" class="bet-username">
      {{ user.username }}
    </div>
    
    <div class="bet-header">
      <div class="bet-game">
        <h4>{{ bet.gameData.gameName.replace(' at ', ' @ ') }}</h4>
        <span class="bet-date">Bet placed at {{ formatDate(bet.createdAt) }}</span>
        <span v-if="getGameStartTime(bet)" class="game-start-time">Game starts at {{ getGameStartTime(bet) }}</span>
      </div>
      <div class="bet-header-right">
        <div class="bet-header-right-content">
          <!-- Final score for completed bets -->
          <div v-if="getFinalScoreData(bet)" class="final-score-inline">
            <span class="final-score-text">
              {{ getFinalScoreData(bet).homeTeam }} {{ getFinalScoreData(bet).homeScore }} - {{ getFinalScoreData(bet).awayScore }} {{ getFinalScoreData(bet).awayTeam }}
              <span v-if="bet.betType === 'total'" class="total-badge">
                ({{ getTotalPoints(getFinalScoreData(bet)) }})
              </span>
              <span v-if="bet.betType === 'spread' && getSpreadDifference(bet) !== null" class="spread-badge">
                ({{ getSpreadDifference(bet) }})
              </span>
            </span>
          </div>
          <!-- Status badge -->
          <div class="bet-status" :class="getStatusClass(bet.status)">
            {{ formatStatus(bet.status) }}
          </div>
          <!-- Cancel button (only for personal active bets) -->
          <button 
            v-if="showCancelButton && canCancelBet(bet)"
            @click="$emit('cancel-bet', bet._id)" 
            :disabled="cancellingBetId === bet._id"
            class="cancel-bet-btn-header"
          >
            {{ cancellingBetId === bet._id ? 'Cancelling...' : 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="bet-details">
      <div class="bet-type-info">
        <span class="bet-type">{{ formatBetType(bet.betType) }}</span>
        <span class="bet-selection">{{ formatBetSelection(bet) }}</span>
      </div>
      <div class="bet-amounts">
        <div class="bet-amount">
          <span class="label">Wagered:</span>
          <span class="value">${{ bet.amount.toLocaleString() }}</span>
        </div>
        <div class="bet-amount">
          <span class="label">{{ getAmountLabel(bet.status) }}</span>
          <span class="value" :class="getAmountValueClass(bet.status)">
            {{ getAmountValue(bet.status) }}
          </span>
        </div>
      </div>
      <div class="bet-odds">
        <span class="label">Odds:</span>
        <span class="value">{{ bet.odds }}</span>
      </div>
    </div>
    
    <!-- Live Game Data -->
    <div v-if="isGameLive(bet)" class="live-game-data">
      <div class="live-score">
        <span class="team-score">{{ getLiveData(bet)?.homeTeam }} {{ getLiveData(bet)?.homeScore }}</span>
        <span class="score-separator">-</span>
        <span class="team-score">{{ getLiveData(bet)?.awayScore }} {{ getLiveData(bet)?.awayTeam }}</span>
      </div>
      <div class="live-status">
        <span class="live-indicator">● LIVE</span>
        <span class="game-time">{{ getLiveData(bet)?.status }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { formatRelativeTime } from '../utils/timezoneUtils.js'

export default {
  name: 'BetCard',
  props: {
    bet: {
      type: Object,
      required: true
    },
    user: {
      type: Object,
      default: null
    },
    liveScores: {
      type: Map,
      default: () => new Map()
    },
    showCancelButton: {
      type: Boolean,
      default: false
    },
    cancellingBetId: {
      type: String,
      default: null
    },
    canCancelBet: {
      type: Function,
      default: () => false
    }
  },
  emits: ['cancel-bet'],
  computed: {
    // Track Map size to force reactivity when Map changes
    liveScoresSize() {
      return this.liveScores ? this.liveScores.size : 0
    },
    // Convert Map to reactive object for Vue's reactivity system
    liveScoresReactive() {
      // Access size to track Map changes - this makes the computed reactive
      const size = this.liveScoresSize
      if (!this.liveScores) return {}
      const scores = {}
      this.liveScores.forEach((value, key) => {
        scores[key] = value
      })
      return scores
    }
  },
  methods: {
    formatDate(dateString) {
      if (!dateString) return 'Unknown date'
      
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    formatBetType(betType) {
      switch (betType) {
        case 'spread': return 'Point Spread'
        case 'moneyline': return 'Moneyline'
        case 'total': return 'Total Points'
        default: return betType
      }
    },
    formatBetSelection(bet) {
      // For over/under bets, include the line amount
      if (bet.betType === 'total' && bet.line) {
        let lineNumber
        if (typeof bet.line === 'string') {
          lineNumber = bet.line.replace(/[ou]/i, '')
        } else if (typeof bet.line === 'number') {
          lineNumber = bet.line.toString()
        } else {
          return bet.selection
        }
        return `${bet.selection} ${lineNumber}`
      }
      
      // For spread bets, include the signed line. Math.abs() used to strip the
      // minus off a favourite, so "Bears -3.5" and "Bears +3.5" both rendered
      // as "Bears (3.5)" — you could not tell which side of the number you had.
      if (bet.betType === 'spread' && bet.line) {
        const line = parseFloat(bet.line)
        if (Number.isNaN(line)) return bet.selection
        return `${bet.selection} ${line > 0 ? '+' : ''}${line}`
      }
      
      // For moneyline and other bets, just return the selection
      return bet.selection
    },
    formatGameStartTime(timeString) {
      if (!timeString) return null
      
      // Use the existing timezone utility to format relative time
      if (timeString.includes('PM') || timeString.includes('AM')) {
        return formatRelativeTime(timeString)
      }
      
      return timeString
    },
    getGameStartTime(bet) {
      // Only show for pending bets
      if (bet.status !== 'pending') return null
      
      // Check if game has started using live scores
      const liveData = this.liveScores.get(bet.gameId) || this.liveScoresReactive[bet.gameId]
      if (liveData) {
        // If game has started or completed, don't show start time
        if (liveData.isLive || liveData.isCompleted) return null
        
        // If we have formatted start time, use it
        if (liveData.gameStartTimeFormatted) {
          return this.formatGameStartTime(liveData.gameStartTimeFormatted)
        }
        
        // Otherwise, format from ISO date
        if (liveData.gameStartTime) {
          const date = new Date(liveData.gameStartTime)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }
        }
      }
      
      // Fallback: Check stored gameData for start time (from when bet was placed)
      if (bet.gameData) {
        // Try formatted time first
        if (bet.gameData.gameStartTimeFormatted) {
          return this.formatGameStartTime(bet.gameData.gameStartTimeFormatted)
        }
        
        // Otherwise, format from ISO date
        if (bet.gameData.gameStartTime) {
          const date = new Date(bet.gameData.gameStartTime)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            })
          }
        }
      }
      
      // If no data available, return null
      return null
    },
    getFinalScoreData(bet) {
      // Only show final score for completed bets (won/lost/push)
      if (bet.status !== 'won' && bet.status !== 'lost' && bet.status !== 'push') return null
      
      // First, check if bet has actualResult (from backend)
      if (bet.actualResult) {
        // Normalize actualResult to match expected format
        const homeScore = typeof bet.actualResult.homeScore === 'object' 
          ? parseInt(bet.actualResult.homeScore.$numberInt || bet.actualResult.homeScore) 
          : parseInt(bet.actualResult.homeScore) || 0
        
        const awayScore = typeof bet.actualResult.awayScore === 'object'
          ? parseInt(bet.actualResult.awayScore.$numberInt || bet.actualResult.awayScore)
          : parseInt(bet.actualResult.awayScore) || 0
        
        return {
          homeTeam: bet.actualResult.homeTeam,
          awayTeam: bet.actualResult.awayTeam,
          homeScore: homeScore,
          awayScore: awayScore,
          isCompleted: true,
          isLive: false,
          status: bet.actualResult.gameStatus || 'Final'
        }
      }
      
      // Fallback to live scores if available
      const liveData = this.liveScores.get(bet.gameId)
      if (!liveData) return null
      
      // Don't show final score if game is still live (shouldn't happen for completed bets, but safety check)
      if (liveData.isLive && !liveData.isCompleted) return null
      
      // Return score data for completed bets
      return liveData
    },
    getTotalPoints(scoreData) {
      if (!scoreData) return null
      const homeScore = parseInt(scoreData.homeScore) || 0
      const awayScore = parseInt(scoreData.awayScore) || 0
      return homeScore + awayScore
    },
    getSpreadDifference(bet) {
      // Only show for completed bets (won/lost/push)
      if (bet.status !== 'won' && bet.status !== 'lost' && bet.status !== 'push') return null
      
      const scoreData = this.getFinalScoreData(bet)
      if (!scoreData) return null
      
      const homeScore = parseInt(scoreData.homeScore) || 0
      const awayScore = parseInt(scoreData.awayScore) || 0
      
      // Return the simple difference (absolute value of home score - away score)
      return Math.abs(homeScore - awayScore)
    },
    formatStatus(status) {
      if (!status) return 'Pending'
      if (status === 'pending') return 'Pending'
      return status.charAt(0).toUpperCase() + status.slice(1)
    },
    getStatusClass(status) {
      if (!status) return 'pending'
      return status.toLowerCase()
    },
    // Check if game is live - using method with computed dependency
    isGameLive(bet) {
      if (!bet || !bet.gameId) return false
      // Access computed to ensure reactivity
      const scores = this.liveScoresReactive
      const liveData = scores[bet.gameId] || this.liveScores.get(bet.gameId)
      if (!liveData) return false
      const isLive = liveData.isLive && !liveData.isCompleted
      return isLive
    },
    // Get live data - using method with computed dependency
    getLiveData(bet) {
      if (!bet || !bet.gameId) return null
      // Access computed to ensure reactivity
      const scores = this.liveScoresReactive
      return scores[bet.gameId] || this.liveScores.get(bet.gameId)
    },
    getAmountLabel(status) {
      if (status === 'won') return 'Won:'
      if (status === 'lost') return 'Lost:'
      if (status === 'push') return 'Returned:'
      return 'Potential Win:'
    },
    getAmountValue(status) {
      if (status === 'won') {
        return `+$${this.bet.potentialWin.toLocaleString()}`
      }
      if (status === 'lost') {
        return `-$${this.bet.amount.toLocaleString()}`
      }
      if (status === 'push') {
        return `$${this.bet.amount.toLocaleString()}`
      }
      return `$${this.bet.potentialWin.toLocaleString()}`
    },
    getAmountValueClass(status) {
      if (status === 'won') return 'won'
      if (status === 'lost') return 'lost'
      if (status === 'push') return 'push'
      return 'potential'
    }
  }
}
</script>

<style scoped>
/* A settled or open wager, shown in history, the friends feed and the game
   modal. Rules and a status pill instead of a coloured card body — the tint
   used to fight the figures inside it. */
.bet-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.bet-card.won { border-left-color: var(--color-success); }
.bet-card.lost { border-left-color: var(--color-danger); }
.bet-card.push { border-left-color: var(--color-warning); }
.bet-card.active { border-left-color: var(--color-primary); }

.bet-username {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.bet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.bet-game {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.bet-game h4 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--display-weight);
  text-transform: uppercase;
  letter-spacing: var(--display-tracking);
  line-height: 1.1;
  color: var(--color-text);
}

.bet-date,
.game-start-time {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.bet-header-right { flex: 0 0 auto; }

.bet-header-right-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.final-score-inline,
.final-score-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.total-badge,
.spread-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.bet-status {
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
}

/* getStatusClass() lowercases the raw status: pending | won | lost | push */
.bet-status.won { background: var(--color-success-soft); color: var(--color-success); }
.bet-status.lost { background: var(--color-danger-soft); color: var(--color-danger); }
.bet-status.push { background: var(--color-warning-soft); color: var(--color-warning); }
.bet-status.pending { background: var(--color-primary-soft); color: var(--color-primary); }

.cancel-bet-btn-header {
  height: 26px;
  padding: 0 var(--space-2);
  background: transparent;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

.cancel-bet-btn-header:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.cancel-bet-btn-header:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Details ── */
.bet-details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.bet-type-info {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.bet-type {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.bet-selection {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

.bet-amounts {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.bet-amount,
.bet-odds {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.bet-amount .label,
.bet-odds .label {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.bet-amount .value,
.bet-odds .value {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.bet-amount .value.won { color: var(--color-success); }
.bet-amount .value.lost { color: var(--color-danger); }
.bet-amount .value.push { color: var(--color-warning); }

/* ── Live ── */
.live-game-data {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
}

.live-score {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.score-separator { color: var(--color-text-subtle); }

.live-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.live-indicator {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-danger);
  white-space: nowrap;
}

.game-time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .bet-header,
  .bet-details {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .bet-header-right-content { justify-content: flex-start; }
}
</style>
