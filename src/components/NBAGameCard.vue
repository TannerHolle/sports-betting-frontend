<template>
  <div class="game-card" :class="{ collapsed: isCollapsed }">
    <div class="game-header">
      <div class="game-info">
        <h3 class="game-title">{{ game.name.replace(' at ', ' @ ') }}</h3>
        <div class="game-meta">
          <span class="venue">{{ venue }}</span>
          <span class="broadcast" v-if="broadcast && !isCollapsed">{{ broadcast }}</span>
        </div>
      </div>
      <div class="game-header-right">
        <div class="game-status" :class="statusClass">
          {{ statusText }}
        </div>
        <div v-if="hasBets" class="bet-indicator" @click="openBetsModal">
          <span class="bet-badge">{{ betCount }} bet{{ betCount > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="inParlaySlip" class="bet-indicator parlay-indicator">
          <span class="bet-badge">In parlay</span>
        </div>
        <button
          @click="toggleCollapsed"
          class="collapse-btn"
          :class="{ expanded: !isCollapsed }"
          :aria-label="isCollapsed ? 'Expand game' : 'Collapse game'"
        >
          <svg class="icon-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <!-- Collapsed view - just scores -->
    <div v-if="isCollapsed" class="collapsed-scores">
      <div class="collapsed-team" v-for="competitor in competitors" :key="competitor.id" :class="{ 'winning': isWinning(competitor) }" :style="teamRailStyle(competitor)">
        <span class="team-rail"></span>
        <img :src="competitor.team.logo" :alt="competitor.team.displayName" class="team-logo-tiny" />
        <span class="team-name-tiny">
          {{ competitor.team.shortDisplayName }}
        </span>
        <span class="score-medium" :class="{ 'winning-score': isWinning(competitor) }">{{ competitor.score || '0' }}</span>
      </div>
      <!-- Show if betting options are available -->
      <div v-if="betting && gameScheduled" class="odds-indicator" @click="toggleCollapsed">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Odds available</span>
      </div>
    </div>

    <!-- Expanded view -->
    <div v-else>
      <div class="teams">
        <div 
          v-for="competitor in competitors" 
          :key="competitor.id"
          class="team"
          :class="{ 
            'home': competitor.homeAway === 'home', 
            'away': competitor.homeAway === 'away',
            'winning': isWinning(competitor)
          }"
          :style="teamRailStyle(competitor)"
        >
          <div class="team-info">
            <span class="team-rail"></span>
            <img :src="competitor.team.logo" :alt="competitor.team.displayName" class="team-logo" />
            <div class="team-details">
              <div class="team-name">{{ competitor.team.shortDisplayName }}</div>
              <div class="team-record">{{ getRecord(competitor.records) }}</div>
            </div>
          </div>
          <div class="team-score">
            <div class="score" :class="{ 'winning-score': isWinning(competitor) }">{{ competitor.score || '0' }}</div>
            <div class="quarters" v-if="competitor.linescores && competitor.linescores.length > 0">
              <span 
                v-for="(quarter, index) in competitor.linescores" 
                :key="index"
                class="quarter-score"
              >
                {{ quarter.displayValue }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Betting Information - Only show for scheduled games -->
      <div class="betting-info" v-if="betting && !isCollapsed && gameScheduled">
        <h4 class="betting-title">Betting Lines</h4>
        <div class="betting-lines">
          <div class="betting-line" v-if="betting.pointSpread">
            <span class="betting-label">Spread:</span>
            <span class="betting-value">
              <span class="favorite-team">{{ getFavoriteTeam() }}</span> {{ getSpreadLine() }} ({{ getSpreadOdds() }})
            </span>
          </div>
          <div class="betting-line" v-if="betting.total">
            <span class="betting-label">Total:</span>
            <span class="betting-value">
              {{ betting.total.over.close.line }} ({{ betting.total.over.close.odds }})
            </span>
          </div>
          <div class="betting-line" v-if="betting.moneyline">
            <span class="betting-label">Moneyline:</span>
            <span class="betting-value">
              <span class="moneyline-team">{{ getHomeTeamName() }} {{ betting.moneyline.home.close.odds }}</span> / 
              <span class="moneyline-team">{{ getAwayTeamName() }} {{ betting.moneyline.away.close.odds }}</span>
            </span>
          </div>
        </div>
        <!-- Ask AI Button -->
        <button 
          v-if="betting && gameScheduled && FEATURES.SHOW_AI_CHAT" 
          @click="handleAskAI" 
          class="ask-ai-button"
        >
          Get help understanding these betting lines from AI
        </button>
        <!-- Betting Interface -->
        <BettingInterface :game="game" :betting="betting" :sport="sport" />
      </div>

      <div class="game-actions">
        <a 
          v-for="link in game.links" 
          :key="link.rel.join('-')"
          :href="link.href" 
          target="_blank" 
          rel="noopener noreferrer"
          class="action-link"
        >
          {{ link.text }}
        </a>
      </div>
    </div>
    
    <!-- Game Bets Modal -->
    <GameBetsModal 
      :is-open="showBetsModal" 
      :bets="gameBets" 
      @close="closeBetsModal" 
    />
  </div>
</template>

<script>
import { computed, ref, onMounted } from 'vue'
import BettingInterface from './BettingInterface.vue'
import GameBetsModal from './GameBetsModal.vue'
import oddsService from '../services/oddsService.js'
import { convertToLocalTime, formatRelativeTime } from '../utils/timezoneUtils.js'
import { useChatWidget } from '../composables/useChatWidget.js'
import { FEATURES } from '../config/features.js'
import { useUserStore } from '../stores/userStore.js'
import { useBetSlip } from '../stores/betSlipStore.js'
import { teamRailStyle } from '../utils/teamColors.js'

export default {
  name: 'NBAGameCard',
  components: {
    BettingInterface,
    GameBetsModal
  },
  props: {
    game: {
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
    // Mirrors the existing "n bets" badge so a slipped game reads the same way
    const inParlaySlip = computed(() => betSlip.hasGame(props.game.id))
    const isCollapsed = ref(true)
    const gameOdds = ref(null)
    const showBetsModal = ref(false)
    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(() => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0])
    const status = computed(() => competition.value?.status)
    
    // Check if user has bets on this game
    const gameBets = computed(() => {
      if (!userStore.currentUser.value?.bets) return []
      return userStore.currentUser.value.bets.filter(bet => bet.gameId === props.game.id)
    })
    
    const hasBets = computed(() => gameBets.value.length > 0)
    const betCount = computed(() => gameBets.value.length)
    
    const openBetsModal = () => {
      showBetsModal.value = true
    }
    
    const closeBetsModal = () => {
      showBetsModal.value = false
    }
    
    // Get team names for odds matching
    const homeTeamName = computed(() => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      return homeTeam ? homeTeam.team.shortDisplayName : ''
    })
    
    const awayTeamName = computed(() => {
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      return awayTeam ? awayTeam.team.shortDisplayName : ''
    })
    
    // Fetch odds data for this game
    const fetchGameOdds = async () => {
      try {
        const allOdds = await oddsService.getAllOdds()
        const homeTeam = competitors.value.find(c => c.homeAway === 'home')?.team
        const awayTeam = competitors.value.find(c => c.homeAway === 'away')?.team
        const gameOddsData = oddsService.findGameOdds(allOdds, 'nba', homeTeam, awayTeam, props.game.date)
        
        if (gameOddsData) {
          gameOdds.value = gameOddsData
        }
      } catch (error) {
        console.error('Error fetching game odds:', error)
      }
    }
    
    // Convert odds data to betting format
    const betting = computed(() => {
      if (!gameOdds.value) {
        return null
      }
      
      return oddsService.convertOddsToBettingFormat(
        gameOdds.value,
        homeTeamName.value,
        awayTeamName.value
      )
    })
    
    const gameInProgress = computed(() => status.value?.type?.state === 'in')
    const gameCompleted = computed(() => status.value?.type?.completed)
    const gameScheduled = computed(() => status.value?.type?.state === 'pre')
    
    onMounted(() => {
      fetchGameOdds()
    })
    
    const statusClass = computed(() => {
      if (gameCompleted.value) return 'completed'
      if (gameInProgress.value) return 'in-progress'
      return 'scheduled'
    })
    
    const statusText = computed(() => {
      if (gameCompleted.value) return 'Final'
      if (gameInProgress.value) {
        return `${status.value.displayClock} - ${status.value.period}${getOrdinalSuffix(status.value.period)}`
      }
      // Convert scheduled game time to user's local timezone
      const shortDetail = status.value?.type?.shortDetail
      if (shortDetail && shortDetail.includes('PM') || shortDetail?.includes('AM')) {
        return formatRelativeTime(shortDetail)
      }
      return shortDetail || 'Scheduled'
    })

    const getRecord = (records) => {
      if (!records || !records.length) return ''
      const overall = records.find(r => r.type === 'total')
      return overall ? overall.summary : ''
    }

    const getOrdinalSuffix = (num) => {
      if (num >= 11 && num <= 13) return 'th'
      switch (num % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }

    const toggleCollapsed = () => {
      isCollapsed.value = !isCollapsed.value
    }

    const getFavoriteTeam = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = parseFloat(betting.value.pointSpread.home.close.line)
      const awayLine = parseFloat(betting.value.pointSpread.away.close.line)
      
      if (homeLine < 0) {
        return getHomeTeamName() // Home team is favorite
      } else {
        return getAwayTeamName() // Away team is favorite
      }
    }

    const getSpreadLine = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = betting.value.pointSpread.home.close.line
      const awayLine = betting.value.pointSpread.away.close.line
      
      // Return the line for the favorite (negative number)
      if (parseFloat(homeLine) < 0) {
        return homeLine
      } else {
        return awayLine
      }
    }

    const getSpreadOdds = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = parseFloat(betting.value.pointSpread.home.close.line)
      
      if (homeLine < 0) {
        return betting.value.pointSpread.home.close.odds
      } else {
        return betting.value.pointSpread.away.close.odds
      }
    }

    const getHomeTeamName = () => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      return homeTeam ? homeTeam.team.shortDisplayName : 'Home'
    }

    const getAwayTeamName = () => {
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      return awayTeam ? awayTeam.team.shortDisplayName : 'Away'
    }

    const isWinning = (competitor) => {
      if (!competitors.value || competitors.value.length !== 2) return false
      
      const homeScore = parseInt(competitors.value.find(c => c.homeAway === 'home')?.score || '0')
      const awayScore = parseInt(competitors.value.find(c => c.homeAway === 'away')?.score || '0')
      const currentScore = parseInt(competitor.score || '0')
      
      // If scores are tied, no one is winning
      if (homeScore === awayScore) return false
      
      // Check if this competitor has the higher score
      return currentScore === Math.max(homeScore, awayScore)
    }


    // Get the openChatWithGame method from the composable
    const { openChatWithGame } = useChatWidget()

    const handleAskAI = () => {
      const homeTeam = getHomeTeamName()
      const awayTeam = getAwayTeamName()
      openChatWithGame('nba', homeTeam, awayTeam, props.game.id)
    }

    return {
      isCollapsed,
      competitors,
      venue,
      broadcast,
      betting,
      gameInProgress,
      gameCompleted,
      gameScheduled,
      status,
      statusClass,
      statusText,
      getRecord,
      getOrdinalSuffix,
      toggleCollapsed,
      getFavoriteTeam,
      getSpreadLine,
      getSpreadOdds,
      getHomeTeamName,
      getAwayTeamName,
      isWinning,
      teamRailStyle,
      handleAskAI,
      FEATURES,
      hasBets,
      betCount,
      inParlaySlip,
      gameBets,
      showBetsModal,
      openBetsModal,
      closeBetsModal
    }
  }
}
</script>

<style scoped>
.collapse-btn .icon-chevron {
  transition: transform 0.16s ease;
}

.collapse-btn.expanded .icon-chevron {
  transform: rotate(180deg);
}

/* Live Game State Styles */
.live-game-state {
  background: var(--color-text);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
  color: var(--color-text-inverse);
  border: 1px solid var(--color-text-muted);
}

.game-clock {
  text-align: center;
  margin-bottom: 12px;
}

.clock-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.time {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-success-light);
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.quarter {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-weight: 500;
}

/* Team rows are not interactive - no lift or shadow on hover, which read as a
   button and promised a click that never existed. The card's real affordances
   are the collapse control, the bet badge and the links in the footer. */

.team-name {
  color: var(--color-text);
  font-weight: 600;
}

.odds-indicator {
  text-align: center;
  margin-top: 8px;
  font-size: var(--text-xs);
  color: var(--color-success);
  font-weight: 500;
  cursor: pointer;
}

.ask-ai-button {
  width: 100%;
  margin-top: 12px;
  padding: 10px 16px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ask-ai-button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.ask-ai-button:active {
  transform: translateY(0);
}

.bet-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-success-light);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.bet-indicator:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.bet-badge {
  background: transparent;
  color: var(--color-text-inverse);
  font-weight: 700;
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-lg);
  min-width: 18px;
  text-align: center;
}

.parlay-indicator {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.bet-icon {
  font-size: var(--text-sm);
}

/* Ask AI button is now visible on mobile - it will navigate to chat page */
</style>
