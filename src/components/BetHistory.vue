<template>
  <div class="bet-history" v-if="isAuthenticated">
    <div class="bet-history-header">
      <h3>Your Bets</h3>
      <div class="bet-tabs">
        <button 
          @click="switchTab('active')" 
          :class="{ active: activeTab === 'active' }"
          class="tab-btn"
        >
          Active ({{ activeBets.length }})
        </button>
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
    </div>

    <!-- Active Bets -->
    <div v-if="activeTab === 'active'" class="bets-section">
      <div v-if="activeBets.length === 0" class="no-bets">
        <p>No active bets. <br></br>Place a bet and track it here!</p>
      </div>
      <div v-else class="bets-list">
        <BetCard
          v-for="(bet, index) in activeBets" 
          :key="`active-bet-${bet._id}-${index}`"
          :bet="bet"
          :live-scores="liveScores"
          :show-cancel-button="true"
          :cancelling-bet-id="cancellingBetId"
          :can-cancel-bet="canCancelBet"
          @cancel-bet="handleCancelBet"
        />
      </div>
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

    <!-- Cancel Bet Confirmation Modal -->
    <div v-if="showCancelModal" class="modal-overlay" @click.self="closeCancelModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cancel Bet?</h3>
          <button @click="closeCancelModal" class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to cancel this bet?</p>
          <p class="modal-info"><strong>${{ cancelBetAmount?.toLocaleString() }}</strong> will be refunded to your balance.</p>
        </div>
        <div class="modal-footer">
          <button @click="closeCancelModal" class="modal-btn modal-btn-cancel">Keep Bet</button>
          <button @click="confirmCancelBet" :disabled="cancellingBetId" class="modal-btn modal-btn-confirm">
            {{ cancellingBetId ? 'Cancelling...' : 'Cancel Bet' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
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
    const activeTab = ref('active')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)
    const cancellingBetId = ref(null)
    const gameStartStatus = ref(new Map()) // Cache game start status
    const showCancelModal = ref(false)
    const pendingCancelBetId = ref(null)
    const cancelBetAmount = ref(null)
    const currentPage = ref(1)
    const itemsPerPage = ref(10)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const activeBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets.filter(bet => bet.status === 'pending')
    })

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


    // Check if bet can be cancelled (pending and game hasn't started)
    const canCancelBet = (bet) => {
      if (bet.status !== 'pending') return false
      
      // Check if game has started using live scores
      const liveData = liveScores.value.get(bet.gameId)
      if (liveData) {
        // If we have live data, check if game has started
        return !liveData.isLive && !liveData.isCompleted
      }
      
      // If we don't have live data yet, we'll check async
      // For now, return true and we'll validate on the backend
      return true
    }

    // Handle cancel bet - show modal
    const handleCancelBet = (betId) => {
      if (cancellingBetId.value) return // Prevent double clicks
      
      const bet = activeBets.value.find(b => b._id === betId)
      if (!bet) return
      
      pendingCancelBetId.value = betId
      cancelBetAmount.value = bet.amount
      showCancelModal.value = true
    }

    // Close cancel modal
    const closeCancelModal = () => {
      if (cancellingBetId.value) return // Don't close if cancelling
      showCancelModal.value = false
      pendingCancelBetId.value = null
      cancelBetAmount.value = null
    }

    // Confirm cancel bet
    const confirmCancelBet = async () => {
      if (!pendingCancelBetId.value) return
      
      const betId = pendingCancelBetId.value
      cancellingBetId.value = betId
      
      try {
        const result = await userStore.cancelBet(betId)
        
        if (result.success) {
          // Success - user data will be refreshed automatically
          // Clear game start status cache for this game
          const bet = activeBets.value.find(b => b._id === betId)
          if (bet) {
            gameStartStatus.value.delete(bet.gameId)
          }
          // Close modal
          showCancelModal.value = false
          pendingCancelBetId.value = null
          cancelBetAmount.value = null
        } else {
          alert(result.error || 'Failed to cancel bet')
        }
      } catch (error) {
        console.error('Error cancelling bet:', error)
        alert('Failed to cancel bet. Please try again.')
      } finally {
        cancellingBetId.value = null
      }
    }

    // Get sport from bet data (now stored with each bet)
    const getSportFromBet = (bet) => {
      // Use stored sport if available, fallback to team name detection for old bets
      if (bet.sport) {
        return bet.sport
      }
      
      // Fallback for old bets without sport data
      const homeTeam = bet.gameData?.homeTeam?.toLowerCase() || ''
      const awayTeam = bet.gameData?.awayTeam?.toLowerCase() || ''
      
      // NFL teams
      const nflTeams = ['commanders', 'chiefs', 'cowboys', 'giants', 'eagles', 'washington', 'kansas city', 'dallas', 'new york', 'philadelphia', 'patriots', 'bills', 'dolphins', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers', 'cardinals', 'rams', '49ers', 'seahawks', 'packers', 'bears', 'lions', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers']
      if (nflTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nfl'
      }
      
      // NBA teams
      const nbaTeams = ['lakers', 'kings', 'clippers', 'trail blazers', 'cavaliers', 'pistons', '76ers', 'magic', 'bulls', 'hawks', 'timberwolves', 'nuggets', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', 'bucks', 'pacers', 'hornets', 'wizards', 'thunder', 'mavericks', 'rockets', 'grizzlies', 'pelicans', 'spurs', 'suns', 'jazz', 'blazers']
      if (nbaTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nba'
      }
      
      // NCAA Basketball teams
      const ncaaBasketballTeams = ['duke', 'kentucky', 'north carolina', 'kansas', 'villanova', 'gonzaga', 'michigan state', 'michigan', 'ohio state', 'indiana', 'purdue', 'wisconsin', 'maryland', 'illinois', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'rutgers', 'penn state', 'ucla', 'usc', 'stanford', 'california', 'arizona', 'arizona state', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'texas', 'texas tech', 'baylor', 'tcu', 'oklahoma', 'oklahoma state', 'kansas state', 'iowa state', 'west virginia', 'syracuse', 'louisville', 'notre dame', 'pittsburgh', 'boston college', 'clemson', 'florida state', 'miami', 'north carolina state', 'wake forest', 'georgia tech', 'virginia', 'virginia tech', 'florida', 'georgia', 'south carolina', 'tennessee', 'vanderbilt', 'auburn', 'alabama', 'mississippi state', 'ole miss', 'lsu', 'arkansas', 'missouri', 'texas a&m']
      if (ncaaBasketballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-basketball'
      }
      
      // NCAA Football teams
      const ncaaFootballTeams = ['alabama', 'auburn', 'georgia', 'florida', 'tennessee', 'lsu', 'texas a&m', 'ole miss', 'mississippi state', 'arkansas', 'missouri', 'kentucky', 'vanderbilt', 'south carolina', 'ohio state', 'michigan', 'penn state', 'michigan state', 'wisconsin', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'illinois', 'purdue', 'indiana', 'maryland', 'rutgers', 'oklahoma', 'texas', 'oklahoma state', 'texas tech', 'baylor', 'tcu', 'kansas state', 'iowa state', 'west virginia', 'kansas', 'clemson', 'florida state', 'miami', 'north carolina', 'north carolina state', 'duke', 'wake forest', 'georgia tech', 'virginia', 'virginia tech', 'boston college', 'pittsburgh', 'syracuse', 'louisville', 'notre dame', 'usc', 'ucla', 'stanford', 'california', 'washington', 'washington state', 'oregon', 'oregon state', 'arizona', 'arizona state', 'colorado', 'utah', 'byu', 'boise state', 'fresno state', 'san diego state', 'utah state', 'hawaii', 'nevada', 'unlv', 'new mexico', 'new mexico state', 'wyoming', 'air force', 'colorado state', 'troy', 'appalachian state', 'coastal carolina', 'georgia southern', 'georgia state', 'marshall', 'old dominion', 'james madison', 'liberty', 'florida atlantic', 'florida international', 'charlotte', 'middle tennessee', 'western kentucky', 'louisiana', 'louisiana monroe', 'south alabama', 'texas state', 'arkansas state', 'ulm', 'tulane', 'southern miss', 'rice', 'north texas', 'utep', 'utsa', 'houston', 'smu', 'tulsa', 'memphis', 'east carolina', 'temple', 'south florida', 'ucf', 'cincinnati', 'navy', 'army', 'air force']
      if (ncaaFootballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-football'
      }
      
      // Default to NBA if we can't determine
      return 'nba'
    }

    // Fetch live scores for all bets
    const fetchLiveScores = async () => {
      if (!allBets.value.length) return

      try {
        // Group bets by sport
        const betsBySport = {}
        allBets.value.forEach(bet => {
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

    // Start periodic refresh for live scores
    const startLiveScoreRefresh = () => {
      // Initial fetch
      fetchLiveScores()
      
      // Set up interval to refresh every 10 seconds
      refreshInterval.value = setInterval(fetchLiveScores, 10000)
    }

    // Stop live score refresh
    const stopLiveScoreRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
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
      isAuthenticated,
      activeBets,
      completedBets,
      paginatedCompletedBets,
      totalPages,
      currentPage,
      liveScores,
      canCancelBet,
      handleCancelBet,
      cancellingBetId,
      showCancelModal,
      closeCancelModal,
      confirmCancelBet,
      cancelBetAmount,
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
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-bottom: var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
}

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

/* ── Confirm modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: rgba(35, 29, 24, 0.45);
  z-index: 1100;
}

.modal-content {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-top: 2px solid var(--color-text);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3,
.modal-header h4 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: var(--display-weight);
  text-transform: uppercase;
  letter-spacing: var(--display-tracking);
  color: var(--color-text);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xl);
  line-height: 1;
  color: var(--color-text-subtle);
  cursor: pointer;
}

.modal-close-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

.modal-info {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border-top: 1px solid var(--color-border);
}

.modal-btn {
  height: 40px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
}

.modal-btn-cancel {
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-muted);
}

.modal-btn-cancel:hover { background: var(--color-surface-muted); color: var(--color-text); }

.modal-btn-confirm {
  background: var(--color-danger);
  border: 1px solid var(--color-danger);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.modal-btn-confirm:hover { filter: brightness(0.92); }

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
