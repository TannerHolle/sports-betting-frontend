<template>
  <div class="brd">
    <!-- meta line -->
    <div class="brd-head">
      <span class="brd-status" :class="statusClass">{{ statusText }}</span>
      <span class="brd-where">
        {{ venue }}<template v-if="broadcast"> &middot; <span class="brd-tv">{{ broadcast }}</span></template>
      </span>
      <button v-if="hasBets" class="brd-badge" @click="showBetsModal = true">
        {{ betCount }} bet{{ betCount > 1 ? 's' : '' }}
      </button>
      <span v-if="inParlaySlip" class="brd-badge brd-badge-parlay">In parlay</span>
    </div>

    <!-- matchup: away then home, the way a printed sheet reads -->
    <div class="brd-teams">
      <div
        v-for="competitor in orderedCompetitors"
        :key="competitor.id"
        class="team-row"
        :style="teamRailStyle(competitor)"
      >
        <span class="team-rail"></span>
        <img
          v-if="competitor.team.logo"
          :src="competitor.team.logo"
          :alt="competitor.team.displayName"
          class="brd-logo"
          loading="lazy"
        />
        <span class="brd-name">
          {{ competitor.team.shortDisplayName }}
          <span v-if="competitor.curatedRank && competitor.curatedRank.current <= 25" class="brd-rank">
            #{{ competitor.curatedRank.current }}
          </span>
        </span>
        <span class="brd-record">{{ getRecord(competitor.records) }}</span>
        <span class="brd-score" :class="{ 'winning-score': isWinning(competitor) }">
          {{ hasStarted ? (competitor.score || '0') : '–' }}
        </span>
      </div>
    </div>

    <!-- odds sit beside the matchup; the stake bar spans both columns -->
    <BettingInterface
      v-if="betting"
      layout="board"
      :game="game"
      :betting="betting"
      :sport="sport"
    />
    <div v-else class="brd-nolines">No lines</div>

    <GameBetsModal
      v-if="showBetsModal"
      :bets="gameBets"
      :game-name="gameName"
      @close="showBetsModal = false"
    />
  </div>
</template>

<script>
import { computed, ref, onMounted } from 'vue'
import BettingInterface from './BettingInterface.vue'
import GameBetsModal from './GameBetsModal.vue'
import oddsService from '../services/oddsService.js'
import { useUserStore } from '../stores/userStore.js'
import { useBetSlip } from '../stores/betSlipStore.js'
import { teamRailStyle } from '../utils/teamColors.js'

/**
 * One game as a single dense row: status, matchup and the full odds grid all
 * visible at once. The betting board used to render the same collapsible
 * game-card as the scoreboard, which hid every price behind an expand — fine
 * for scores, wrong for a board you scan to place a bet.
 *
 * Sport-agnostic: the four sport cards differ only in extras the board omits.
 */
export default {
  name: 'GameBoardRow',
  components: { BettingInterface, GameBetsModal },
  props: {
    game: { type: Object, required: true },
    sport: { type: String, required: true }
  },
  setup(props) {
    const userStore = useUserStore()
    const betSlip = useBetSlip()
    const betting = ref(null)
    const showBetsModal = ref(false)

    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(
      () => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0]
    )
    const status = computed(() => competition.value?.status)
    const gameName = computed(() => props.game.name?.replace(' at ', ' @ ') || '')

    // ESPN lists home first; a board reads away-at-home
    const orderedCompetitors = computed(() => {
      const away = competitors.value.find((c) => c.homeAway === 'away')
      const home = competitors.value.find((c) => c.homeAway === 'home')
      return away && home ? [away, home] : competitors.value
    })

    const gameCompleted = computed(() => !!status.value?.type?.completed)
    const gameScheduled = computed(() => status.value?.type?.state === 'pre')
    const hasStarted = computed(() => !gameScheduled.value)

    const statusClass = computed(() => {
      if (gameCompleted.value) return 'completed'
      if (status.value?.type?.state === 'in') return 'in-progress'
      return 'scheduled'
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

    const statusText = computed(() => {
      if (gameCompleted.value) return 'FINAL'
      if (status.value?.type?.state === 'in') {
        const time = status.value?.displayClock || '0:00'
        const period = status.value?.period || 1
        if ((time === '0:00' || time === '0.0') && period === 2) return 'HALF'
        return `${time} ${period}${getOrdinalSuffix(period)}`.toUpperCase()
      }
      return (status.value?.type?.shortDetail || 'Scheduled').toUpperCase()
    })

    const getRecord = (records) => {
      if (!records || !records.length) return ''
      const overall = records.find((r) => r.type === 'total')
      return overall ? overall.summary : ''
    }

    const isWinning = (competitor) => {
      if (competitors.value.length !== 2 || gameScheduled.value) return false
      const scores = competitors.value.map((c) => parseInt(c.score || '0', 10))
      if (scores[0] === scores[1]) return false
      return parseInt(competitor.score || '0', 10) === Math.max(...scores)
    }

    const gameBets = computed(() => {
      const bets = userStore.currentUser.value?.bets
      if (!bets) return []
      return bets.filter((bet) => bet.gameId === props.game.id)
    })
    const hasBets = computed(() => gameBets.value.length > 0)
    const betCount = computed(() => gameBets.value.length)
    const inParlaySlip = computed(() => betSlip.hasGame(props.game.id))

    // The odds feed is remote, ESPN's embedded book rides along with the game
    // we already have - so a failed fetch still resolves against the fallback.
    const fetchGameOdds = async () => {
      let allOdds = null
      try {
        allOdds = await oddsService.getAllOdds()
      } catch (error) {
        console.error('Error fetching game odds:', error)
      }
      betting.value = oddsService.resolveBetting(allOdds, props.sport, props.game)
    }

    onMounted(fetchGameOdds)

    return {
      orderedCompetitors,
      venue,
      broadcast,
      gameName,
      statusClass,
      statusText,
      gameScheduled,
      hasStarted,
      getRecord,
      isWinning,
      teamRailStyle,
      gameBets,
      hasBets,
      betCount,
      inParlaySlip,
      showBetsModal,
      betting
    }
  }
}
</script>

<style scoped>
/* Two columns: matchup on the left, odds grid on the right. The stake bar and
   actions that BettingInterface renders span both — see .betting-interface.board,
   which uses display:contents so its children join this grid directly. */
.brd {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 448px;
  align-items: end;
  column-gap: var(--space-5);
  row-gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.brd-head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.brd-status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
}

.brd-status.in-progress { background: var(--color-danger-soft); color: var(--color-danger); }
.brd-status.completed { background: var(--color-surface-muted); color: var(--color-text-muted); }

.brd-where {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.brd-tv { font-weight: 500; color: var(--color-text-muted); }

.brd-badge {
  padding: 2px var(--space-2);
  background: transparent;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.brd-badge:hover { border-color: var(--color-text-subtle); color: var(--color-text); }

.brd-badge-parlay {
  border-color: var(--color-primary);
  color: var(--color-primary);
  cursor: default;
}

/* ── Matchup ── */
.brd-teams {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.team-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.team-row .team-rail { min-height: 26px; }

.brd-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex: 0 0 auto;
}

.brd-name {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--color-text);
}

.brd-rank {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-primary);
}

.brd-record {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
}

.brd-score {
  flex: 0 0 auto;
  min-width: 30px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

/* the winner carries its team colour, matching the scoreboard cards */
.brd-score.winning-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px var(--space-2);
  border-radius: var(--radius-md);
  background: var(--team-rail, var(--color-text));
  color: var(--team-ink, var(--color-text-inverse));
  font-weight: 600;
}

.brd-nolines {
  grid-column: 2;
  align-self: end;
  padding-bottom: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  text-align: center;
}

@media (max-width: 1000px) {
  .brd {
    grid-template-columns: minmax(0, 1fr);
  }

  .brd-nolines {
    grid-column: 1;
    text-align: left;
  }
}
</style>
