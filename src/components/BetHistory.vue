<template>
  <div class="bet-history" v-if="isAuthenticated">
    <!-- The tabs used to sit in this row, which forced the disclosure into a
         narrow button and left the chevron stranded mid-header. They belong
         with the content they switch, so the head is now the same shape as
         every other panel's: title, count, chevron hard right. -->
    <button
      type="button"
      class="bet-history-header"
      :aria-expanded="String(!collapsed)"
      @click="toggle"
    >
      <h3>Bet history</h3>
      <span class="section-meta">{{ completedBets.length }} settled</span>
      <span class="section-chevron" :class="{ open: !collapsed }" aria-hidden="true"></span>
    </button>

    <template v-if="!collapsed">
      <div class="bet-tabs">
        <button 
          @click="switchTab('history')" 
          :class="{ active: activeTab === 'history' }"
          class="tab-btn"
        >
          History ({{ completedBets.length }})
        </button>
        <button 
          @click="switchTab('stats')" 
          :class="{ active: activeTab === 'stats' }"
          class="tab-btn"
        >
          Advanced Stats
        </button>
      </div>

    <!-- Bet History -->
    <div v-if="activeTab === 'history'" class="bets-section">
      <div v-if="completedBets.length === 0" class="no-bets">
        <p>No completed bets yet.</p>
      </div>
      <div v-else>
        <div class="bets-list">
          <BetCard
            v-for="(bet, index) in paginatedCompletedBets" 
            :key="`bet-${bet._id}-${index}`"
            :bet="bet"
            :live-scores="liveScores"
            :show-cancel-button="false"
          />
        </div>
        <!-- Pagination Controls -->
        <div v-if="totalPages > 1 || completedBets.length > 0" class="pagination">
          <div class="pagination-left">
            <label class="page-size-label">Items per page:</label>
            <select v-model="itemsPerPage" @change="handlePageSizeChange" class="page-size-select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
          <div v-if="totalPages > 1" class="pagination-right">
            <button 
              @click="goToPage(currentPage - 1)" 
              :disabled="currentPage === 1"
              class="pagination-btn"
            >
              Previous
            </button>
            <div class="pagination-info">
              Page {{ currentPage }} of {{ totalPages }}
            </div>
            <button 
              @click="goToPage(currentPage + 1)" 
              :disabled="currentPage === totalPages"
              class="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced Stats -->
    <div v-if="activeTab === 'stats'" class="bets-section">
      <AdvancedStats />
    </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
import { nextPollDelay } from '../utils/pollCadence.js'
import { getSportFromBet } from '../utils/betSport.js'
import { useCollapsible } from '../composables/useCollapsible.js'
import BetCard from './BetCard.vue'
import AdvancedStats from './AdvancedStats.vue'

export default {
  name: 'BetHistory',
  components: {
    BetCard,
    AdvancedStats
  },
  setup() {
    const userStore = useUserStore()
    const { collapsed, toggle } = useCollapsible('betHistoryCollapsed')
    const activeTab = ref('history')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)
    const gameStartStatus = ref(new Map()) // Cache game start status
    const currentPage = ref(1)
    const itemsPerPage = ref(5)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const completedBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets
        .filter(bet => bet.status === 'won' || bet.status === 'lost' || bet.status === 'push')
        .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt))
    })

    const totalPages = computed(() => {
      return Math.ceil(completedBets.value.length / itemsPerPage.value)
    })

    const paginatedCompletedBets = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return completedBets.value.slice(start, end)
    })

    // Get all bets (active + completed) for live score checking
    const allBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets
    })


    // Only open wagers can change. A settled bet's result already came from
    // the server, so polling ESPN for it buys nothing.
    const liveCandidates = computed(() =>
      allBets.value.filter(bet => bet.status === 'pending'))

    const trackedGames = computed(() => liveCandidates.value.map(bet => ({
      gameId: bet.gameId,
      sport: getSportFromBet(bet),
      gameStartTime: bet.gameData?.gameStartTime || null
    })))

    // Fetch live scores for open wagers
    const fetchLiveScores = async () => {
      if (!liveCandidates.value.length) return

      try {
        // Group bets by sport
        const betsBySport = {}
        liveCandidates.value.forEach(bet => {
          const sport = getSportFromBet(bet)
          if (!betsBySport[sport]) {
            betsBySport[sport] = []
          }
          betsBySport[sport].push(bet)
        })

        // Fetch live scores for each sport
        const allScores = new Map()
        for (const [sport, bets] of Object.entries(betsBySport)) {
          const gameIds = [...new Set(bets.map(bet => bet.gameId))]
          if (gameIds.length > 0) {
            try {
              const scores = await liveScoreService.getLiveScores(gameIds, sport)
              // Merge scores into the main map
              scores.forEach((data, gameId) => {
                allScores.set(gameId, data)
                // Update game start status cache
                if (data) {
                  gameStartStatus.value.set(gameId, data.isLive || data.isCompleted)
                }
              })
            } catch (error) {
              console.error(`Error fetching live scores for ${sport}:`, error)
            }
          }
        }
        
        liveScores.value = allScores
      } catch (error) {
        console.error('Error fetching live scores:', error)
      }
    }

    // Reschedule from what's actually in play rather than a fixed 10s, which
    // spent the same requests on a slate that finished last week. See
    // pollCadence.
    const scheduleLiveScoreRefresh = () => {
      stopLiveScoreRefresh()
      const delay = nextPollDelay(trackedGames.value, liveScores.value)
      if (delay === null) return
      refreshInterval.value = setTimeout(async () => {
        await fetchLiveScores()
        scheduleLiveScoreRefresh()
      }, delay)
    }

    const startLiveScoreRefresh = async () => {
      await fetchLiveScores()
      scheduleLiveScoreRefresh()
    }

    // Stop live score refresh
    const stopLiveScoreRefresh = () => {
      if (refreshInterval.value) {
        clearTimeout(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    // Pagination functions
    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        // Scroll to top of bet history section
        const betHistoryElement = document.querySelector('.bet-history')
        if (betHistoryElement) {
          betHistoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }

    const switchTab = (tab) => {
      activeTab.value = tab
      // Reset to page 1 when switching tabs
      currentPage.value = 1
    }

    const handlePageSizeChange = () => {
      // Reset to page 1 when page size changes
      currentPage.value = 1
      // Scroll to the component container so "Your Bets" title and tabs are visible
      const betHistoryElement = document.querySelector('.bet-history')
      if (betHistoryElement) {
        betHistoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    // Load user data when component mounts
    onMounted(async () => {
      if (isAuthenticated.value && currentUser.value?.username) {
        try {
          // Refresh user data from API to get latest bets
          const freshUserData = await userStore.loadUserFromAPI(currentUser.value.username)
          if (freshUserData) {
            // Start live score refresh after user data is loaded
            startLiveScoreRefresh()
          }
        } catch (error) {
          console.error('Error loading user data in BetHistory:', error)
        }
      }
    })

    // Clean up on unmount
    onUnmounted(() => {
      stopLiveScoreRefresh()
    })

    return {
      activeTab,
      collapsed,
      toggle,
      isAuthenticated,
      completedBets,
      paginatedCompletedBets,
      totalPages,
      currentPage,
      liveScores,
      goToPage,
      switchTab,
      handlePageSizeChange,
      itemsPerPage
    }
  }
}
</script>

<style scoped>
.bet-history {
  display: flex;
  flex-direction: column;
}

.bet-history-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  width: 100%;
  padding: 0 0 var(--space-2);
  background: none;
  border: none;
  border-bottom: 1.5px solid var(--color-text);
  border-radius: 0;
  /* full font, not just family - a button otherwise keeps the UA's 13.33px
     and line-height:normal, which shifts the rule off its neighbours */
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.bet-history-header:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

/* takes the slack, so the chevron lands hard right like the other panels */
.bet-history-header .section-meta { flex: 1 1 auto; }

.bet-history-header h3 {
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

/* .tab-btn is global (the league tabs) and sets flex:1 with 16/24px padding —
   inside the history header that produced full-width slabs. Scoped rules win. */
.bet-tabs {
  display: flex;
  /* It used to be a flex item in the header row, which sized it to its tabs.
     Standing on its own in a block container it would stretch the full
     column, so the border has to be told to hug its contents. */
  width: fit-content;
  margin-top: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.bet-tabs .tab-btn {
  flex: 0 0 auto;
  height: 30px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: none;
  border-left: 1px solid var(--color-border-strong);
  border-bottom: none;
  border-radius: 0;
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.bet-tabs .tab-btn:first-child { border-left: none; }

.bet-tabs .tab-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.bet-tabs .tab-btn.active {
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 600;
  border-bottom: none;
}

.bets-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
}

.no-bets {
  padding: var(--space-8) 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.bets-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-label {
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.loading-state {
  padding: var(--space-8) 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.pagination-left,
.pagination-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pagination-info {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.pagination-btn {
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  cursor: pointer;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.pagination-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.page-size-label {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.page-size-select {
  height: 32px;
  padding: 0 var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}



@media (max-width: 720px) {
  .bet-history-header {
    align-items: stretch;
    flex-direction: column;
  }

  /* The header stacks here, and a stretched flex item would pull the bordered
     group to full width - leaving empty space inside the border that reads as
     one more tab. It hugs its buttons and only scrolls if they overflow. */
  .bet-tabs {
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bet-tabs::-webkit-scrollbar { display: none; }
}
</style>
