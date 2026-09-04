<template>
  <div class="game-card" :class="{ collapsed: isCollapsed }">
    <!-- The headline used to be "Away @ Home", which the two team rows below
         already say. The slot goes to the clock instead - the one thing on a
         live card that changes every play. -->
    <div class="game-header">
      <div class="gh-status">
        <span v-if="gameInProgress" class="live-dot" aria-hidden="true"></span>
        <template v-if="liveClock">
          <span class="gh-clock figure">{{ liveClock.time }}</span>
          <span class="gh-period eyebrow">{{ liveClock.period }}</span>
        </template>
        <span v-else class="game-status" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="game-header-right">
        <span class="venue">{{ venue }}</span>
        <span class="gh-rule" v-if="broadcast" aria-hidden="true"></span>
        <span class="broadcast" v-if="broadcast">{{ broadcast }}</span>
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
          <span v-if="competitor.curatedRank && competitor.curatedRank.current <= 25" class="team-rank-small">
            #{{ competitor.curatedRank.current }}
          </span>
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
      <!-- Line score. The period columns get heads, so 17/14/7 reads as a
           breakdown rather than three loose numbers beside the total. -->
      <div class="teams">
        <div class="ls-head" :style="lineGrid" v-if="showLineScore">
          <span></span>
          <span v-for="head in periodHeads" :key="head" class="eyebrow ls-cell">{{ head }}</span>
          <span class="eyebrow ls-cell ls-total-head">T</span>
        </div>
        <div 
          v-for="competitor in competitors" 
          :key="competitor.id"
          class="team"
          :class="{ 
            'home': competitor.homeAway === 'home', 
            'away': competitor.homeAway === 'away',
            'winning': isWinning(competitor),
            'ls-row': showLineScore
          }"
          :style="[teamRailStyle(competitor), showLineScore ? lineGrid : null]"
        >
          <div class="team-info">
            <span class="team-rail"></span>
            <img :src="competitor.team.logo" :alt="competitor.team.displayName" class="team-logo" />
            <div class="team-details">
              <div class="team-name-line">
                <span class="team-rank" v-if="competitor.curatedRank && competitor.curatedRank.current <= 25">
                  {{ competitor.curatedRank.current }}
                </span>
                <span class="team-name">{{ competitor.team.shortDisplayName }}</span>
                <svg v-if="hasPossession(competitor)" class="poss-icon" width="15" height="10" viewBox="0 0 15 10" fill="none" role="img" :aria-label="`${competitor.team.shortDisplayName} has the ball`">
                  <ellipse cx="7.5" cy="5" rx="7" ry="4.4" fill="currentColor"/>
                  <path d="M5.2 5h4.6M6.6 3.6v2.8M8.4 3.6v2.8" stroke="var(--color-surface)" stroke-width="0.9" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="team-record">{{ getRecord(competitor.records) }}</div>
            </div>
          </div>
          <template v-if="showLineScore">
            <span
              v-for="(value, index) in periodScores(competitor)"
              :key="index"
              class="figure ls-cell"
              :class="{ 'ls-cell-empty': value === null }"
            >{{ value === null ? '&ndash;' : value }}</span>
          </template>
          <span class="figure ls-total" :class="isWinning(competitor) ? 'leading' : 'trailing'">{{ competitor.score || '0' }}</span>
        </div>
      </div>

      <!-- Down, field position, red zone and timeouts all ride along in the
           ESPN payload; the card used to print only the first two, and print
           the yard line twice. shortDownDistanceText is absent between plays
           (a timeout), which is where the old "0th & 13" came from. -->
      <div class="drive" v-if="gameInProgress && hasDriveInfo">
        <div class="drive-state">
          <span class="drive-down figure" :class="{ hot: situation.isRedZone }" v-if="situation.shortDownDistanceText">
            {{ situation.shortDownDistanceText }}
          </span>
          <span class="drive-spot" v-if="situation.possessionText">
            Ball on {{ situation.possessionText }}
          </span>
          <span class="drive-redzone eyebrow" v-if="situation.isRedZone">Red zone</span>
        </div>
        <div class="drive-timeouts" v-if="hasTimeouts">
          <span class="eyebrow">Timeouts</span>
          <span class="to-team" v-for="competitor in competitors" :key="competitor.id">
            <span class="to-abbr">{{ competitor.team.abbreviation }}</span>
            <span class="to-pips">
              <span
                v-for="n in 3"
                :key="n"
                class="to-pip"
                :class="{ used: n > timeoutsFor(competitor) }"
              ></span>
            </span>
          </span>
        </div>
      </div>

      <!-- One line, clipped: a long play description used to wrap and make one
           card taller than the one beside it in the grid. -->
      <div class="last-play-row" v-if="gameInProgress && situation?.lastPlay">
        <span class="eyebrow">Last</span>
        <span class="last-play">{{ situation.lastPlay.text }}</span>
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
import { computed, ref, onMounted, watch } from 'vue'
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
  name: 'NCAAFootballCard',
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
    const betting = ref(null)
    const showBetsModal = ref(false)
    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(() => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0])
    const situation = computed(() => competition.value?.situation)
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
    
    // The odds feed is remote, ESPN's embedded book rides along with the game
    // we already have - so a failed fetch still resolves against the fallback.
    const fetchGameOdds = async () => {
      let allOdds = null
      try {
        allOdds = await oddsService.getAllOdds()
      } catch (error) {
        console.error('Error fetching game odds from service:', error)
      }
      betting.value = oddsService.resolveBetting(allOdds, 'ncaa-football', props.game)
    }
    
    onMounted(() => {
      fetchGameOdds()
    })
    
    // Watch for changes in game data (especially for embedded odds)
    watch(() => props.game.competitions?.[0]?.odds, () => {
      fetchGameOdds()
    }, { deep: true })
    
    const gameInProgress = computed(() => status.value?.type?.state === 'in')
    const gameCompleted = computed(() => status.value?.type?.completed)
    const gameScheduled = computed(() => status.value?.type?.state === 'pre')
    
    // Live games split the clock from the period so each can carry its own
    // weight; halftime and every non-live state keep the single status line.
    const liveClock = computed(() => {
      if (!gameInProgress.value) return null
      const time = status.value?.displayClock || '0:00'
      const period = status.value?.period || 1
      if ((time === '0:00' || time === '0.0') && period === 2) return null
      return { time, period: `${period}${getOrdinalSuffix(period)}` }
    })

    // Column heads for the line score. Regulation is four; overtime extends it
    // as the game goes, so the heads follow the longest linescore on the card.
    const periodHeads = computed(() => {
      const played = competitors.value.reduce(
        (most, c) => Math.max(most, c.linescores?.length || 0), 0
      )
      const count = Math.max(4, played)
      return Array.from({ length: count }, (_, i) => {
        if (i < 4) return String(i + 1)
        return count === 5 ? 'OT' : `${i - 3}OT`
      })
    })

    // Scheduled games have no periods to break down - the columns would be all
    // dashes, so the card drops to name and score until kickoff.
    const showLineScore = computed(() => !gameScheduled.value)

    const lineGrid = computed(() => ({
      gridTemplateColumns: `1fr repeat(${periodHeads.value.length}, 32px) 72px`
    }))

    // Padded to the head count so every column lines up, played or not.
    const periodScores = (competitor) => {
      const scores = competitor.linescores || []
      return periodHeads.value.map((_, i) => scores[i]?.displayValue ?? null)
    }

    const hasPossession = (competitor) =>
      !!situation.value?.possession && situation.value.possession === competitor.team?.id

    const timeoutsFor = (competitor) => {
      const left = competitor.homeAway === 'home'
        ? situation.value?.homeTimeouts
        : situation.value?.awayTimeouts
      return Number.isFinite(left) ? left : 0
    }

    const hasTimeouts = computed(() =>
      Number.isFinite(situation.value?.homeTimeouts) || Number.isFinite(situation.value?.awayTimeouts)
    )

    // Between plays ESPN drops down, distance and possession and leaves the
    // rest of situation in place, so the strip has to earn its padding.
    const hasDriveInfo = computed(() => {
      const s = situation.value
      if (!s) return false
      return !!(s.shortDownDistanceText || s.possessionText || s.isRedZone) || hasTimeouts.value
    })

    const statusClass = computed(() => {
      if (gameCompleted.value) return 'completed'
      if (gameInProgress.value) return 'in-progress'
      return 'scheduled'
    })
    
    const statusText = computed(() => {
      if (gameCompleted.value) return 'Final'
      if (gameInProgress.value) {
        const time = status.value.displayClock || '0:00'
        const period = status.value.period || 1
        
        // Check for halftime (0:00 or 0.0 in 2nd quarter)
        if ((time === '0:00' || time === '0.0') && period === 2) {
          return 'Halftime'
        }
        
        return `${time} - ${period}${getOrdinalSuffix(period)}`
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
      openChatWithGame('ncaa-football', homeTeam, awayTeam, props.game.id)
    }

    return {
      isCollapsed,
      competitors,
      venue,
      broadcast,
      situation,
      betting,
      liveClock,
      periodHeads,
      periodScores,
      showLineScore,
      lineGrid,
      hasPossession,
      timeoutsFor,
      hasTimeouts,
      hasDriveInfo,
      gameInProgress,
      gameCompleted,
      gameScheduled,
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
/* ── Header: clock, not a headline ── */
.game-header {
  align-items: center;
}

.gh-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  flex: 0 0 auto;
}

.gh-clock {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
  line-height: 1;
}

.gh-period {
  color: var(--color-text-muted);
}

.game-header-right {
  min-width: 0;
}

.game-header-right .venue,
.game-header-right .broadcast {
  font-size: var(--text-xs);
  white-space: nowrap;
}

.game-header-right .venue {
  color: var(--color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
}

.gh-rule {
  width: 1px;
  height: 11px;
  background: var(--color-border);
  flex: 0 0 auto;
}

/* ── Line score ── */
.ls-head {
  display: grid;
  align-items: center;
  column-gap: var(--space-2);
  padding: var(--space-2) var(--space-5) var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.ls-cell {
  text-align: center;
}

.ls-total-head {
  text-align: right;
}

.team.ls-row {
  display: grid;
  align-items: center;
  column-gap: var(--space-2);
}

.team-name-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.team-name-line .team-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poss-icon {
  color: var(--color-text);
  flex: 0 0 auto;
  align-self: center;
}

.ls-row .ls-cell {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.ls-row .ls-cell-empty {
  color: var(--color-border-strong);
}

/* The leader is carried by weight and ink. A filled team-colour chip collided
   with the red in-progress status, and with --color-danger meaning a lost bet
   everywhere else in the app. Team colour stays in the rail. */
.ls-total {
  text-align: right;
  font-size: var(--text-3xl);
  line-height: 1;
  letter-spacing: -0.02em;
}

.ls-total.leading {
  font-weight: 600;
  color: var(--color-text);
}

.ls-total.trailing {
  font-weight: 500;
  color: var(--color-text-muted);
}

/* ── Drive ── */
.drive {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}

.drive-state {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.drive-down {
  padding: 4px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
}

.drive-down.hot {
  background: var(--color-warning-soft);
  border-color: transparent;
  color: var(--color-warning);
}

.drive-spot {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.drive-redzone {
  color: var(--color-warning);
}

.drive-timeouts {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.to-team {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.to-abbr {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.to-pips {
  display: flex;
  gap: 3px;
}

.to-pip {
  width: 12px;
  height: 3px;
  border-radius: 1px;
  background: var(--color-text);
}

.to-pip.used {
  background: var(--color-border-strong);
}

/* ── Last play ── */
.last-play-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  min-width: 0;
}

.last-play {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

@media (max-width: 520px) {
  .game-header-right .venue {
    display: none;
  }

  .drive-timeouts {
    gap: var(--space-2);
  }
}

.collapse-btn .icon-chevron {
  transition: transform 0.16s ease;
}

.collapse-btn.expanded .icon-chevron {
  transform: rotate(180deg);
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
