<template>
  <div class="leaderboard" v-if="isAuthenticated">
    <div class="leaderboard-header">
      <h3>{{ (selectedLeagueName || 'Worldwide') }} Leaderboard</h3>
      <p class="leaderboard-description">
        Top performers by total winnings
      </p>
      <div class="leaderboard-controls">
        <div class="league-selector" v-if="availableLeagues && availableLeagues.length > 0">
          <label for="league-select">View League:</label>
          <select 
            id="league-select" 
            v-model="selectedLeagueId"
            @change="onLeagueChange"
            class="league-dropdown"
          >
            <option value="">Worldwide</option>
            <option 
              v-for="league in availableLeagues" 
              :key="league._id" 
              :value="league._id"
            >
              {{ league.name }}
            </option>
          </select>
        </div>
        <div class="limit-selector">
          <label for="limit-select">Show:</label>
          <select 
            id="limit-select" 
            v-model="leaderboardLimit"
            @change="onLimitChange"
            class="limit-dropdown"
          >
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
        </div>
      </div>
    </div>

    <div class="leaderboard-content" v-if="!loading && leaderboard.length > 0">
      <div 
        v-for="(user, index) in leaderboard" 
        :key="user.username"
        class="leaderboard-item"
        :class="{ 'current-user': user.username === currentUser?.username }"
      >
        <div class="rank">
          <span class="rank-number">{{ user.displayRank }}</span>
        </div>
        
        <div class="user-info">
          <div class="username">{{ user.username }}</div>
          <div class="user-stats">
            <!--<span class="stat">${{ user.totalCash.toLocaleString() }} total cash</span>-->
            <span class="stat">${{ user.totalWon.toLocaleString() }} won</span>
            <span class="stat">${{ user.totalLost.toLocaleString() }} lost</span>
            <span class="stat">{{ user.winRate }}% win rate</span>
            <span class="stat">{{ user.totalBets }} bets</span>
          </div>
        </div>
        
        <div class="user-amount">
          <span class="amount" :class="{ 'positive': user.netProfit > 0, 'negative': user.netProfit < 0 }">
            {{ user.netProfit >= 0 ? '+' : '' }}${{ user.netProfit.toLocaleString() }}
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading leaderboard...</p>
    </div>

    <div v-else class="empty-state">
      <p>No data available yet</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'Leaderboard',
  props: {
    userLeagues: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const userStore = useUserStore()
    const leaderboard = ref([])
    const loading = ref(false)
    const selectedLeagueId = ref('')
    const userLeagues = ref([])
    const leaderboardLimit = ref(5)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)
    
    // Use prop leagues if provided, otherwise use local state
    const availableLeagues = computed(() => {
      return props.userLeagues && props.userLeagues.length > 0 ? props.userLeagues : userLeagues.value
    })

    // Watch for changes in available leagues and set default selection
    // Only set default on initial load (when selectedLeagueId is empty)
    watch(availableLeagues, (newLeagues) => {
      // Only auto-select if:
      // 1. User hasn't made a selection yet (selectedLeagueId is empty)
      // 2. User has exactly one league
      if (selectedLeagueId.value === '' && newLeagues && newLeagues.length === 1) {
        setDefaultLeagueSelection(newLeagues)
      }
    }, { immediate: false }) // Don't run immediately, let onMounted handle initial setup
    
    const selectedLeagueName = computed(() => {
      if (!selectedLeagueId.value || !availableLeagues.value) return null
      const league = availableLeagues.value.find(l => l._id === selectedLeagueId.value)
      return league ? league.name : null
    })


    const fetchUserLeagues = async () => {
      if (props.userLeagues && props.userLeagues.length > 0) {
        // If leagues are provided via props, use them and set default
        setDefaultLeagueSelection(props.userLeagues)
        return
      }
      
      if (!currentUser.value?.username) return
      
      try {
        const response = await axios.get(`${API_BASE_URL}/user/${currentUser.value.username}/leagues`)
        userLeagues.value = response.data || []
        setDefaultLeagueSelection(userLeagues.value)
      } catch (error) {
        console.error('Error fetching user leagues:', error)
        userLeagues.value = []
      }
    }

    const setDefaultLeagueSelection = (leagues) => {
      // Only set default if no selection has been made yet
      // If user has exactly one league, default to that league
      // If user has multiple leagues or no leagues, default to worldwide (empty)
      if (selectedLeagueId.value === '') {
        if (leagues && leagues.length === 1) {
          selectedLeagueId.value = leagues[0]._id
          // Fetch leaderboard for the selected league
          fetchLeaderboard()
        }
        // Otherwise, selectedLeagueId remains empty (worldwide), which is already the default
      }
    }

    const onLeagueChange = () => {
      fetchLeaderboard()
    }

    const onLimitChange = () => {
      fetchLeaderboard()
    }

    const fetchLeaderboard = async () => {
      loading.value = true
      try {
        // The server computes these rows - fetching every user's full bet
        // history just to reduce it here cost hundreds of KB per load.
        const url = selectedLeagueId.value
          ? `${API_BASE_URL}/leaderboard?leagueId=${selectedLeagueId.value}`
          : `${API_BASE_URL}/leaderboard`
        const response = await axios.get(url)
        const allLeaderboardData = response.data || []

        // Find current user's actual rank (1-based)
        const currentUsername = currentUser.value?.username
        const currentUserRank = currentUsername 
          ? allLeaderboardData.findIndex(user => user.username === currentUsername) + 1
          : null

        // Get top N based on selected limit
        const limit = leaderboardLimit.value
        const topN = allLeaderboardData.slice(0, limit)
        
        // Check if current user is in top N
        const currentUserInTopN = currentUsername && topN.some(user => user.username === currentUsername)
        
        // Build display list: top N + current user if not in top N
        let displayList = [...topN]
        
        if (currentUserRank && !currentUserInTopN && currentUserRank > limit) {
          // Find current user in full list and add them after the top N
          const currentUserData = allLeaderboardData.find(user => user.username === currentUsername)
          if (currentUserData) {
            displayList.push(currentUserData)
          }
        }

        // Add displayRank to each entry
        const leaderboardData = displayList.map((user, index) => {
          // If this is beyond the limit and it's the current user, show their actual rank
          if (index === limit && user.username === currentUsername && currentUserRank) {
            return {
              ...user,
              displayRank: currentUserRank
            }
          }
          // Otherwise show position in display list (1, 2, 3, ...)
          return {
            ...user,
            displayRank: index + 1
          }
        })

        leaderboard.value = leaderboardData
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        loading.value = false
      }
    }

    onMounted(async () => {
      await fetchUserLeagues()
      // Only fetch leaderboard if we haven't already (setDefaultLeagueSelection will fetch if needed)
      if (!selectedLeagueId.value) {
        fetchLeaderboard()
      }
    })

    return {
      isAuthenticated,
      currentUser,
      leaderboard,
      loading,
      selectedLeagueId,
      selectedLeagueName,
      onLeagueChange,
      availableLeagues,
      leaderboardLimit,
      onLimitChange
    }
  }
}
</script>

<style scoped>
.leaderboard {
  display: flex;
  flex-direction: column;
}

.leaderboard-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
}

.leaderboard-header h3 {
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

.leaderboard-description { display: none; }

.leaderboard-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.league-selector,
.limit-selector {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.league-selector label,
.limit-selector label {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.league-dropdown,
.limit-dropdown {
  height: 28px;
  min-width: 0;
  padding: 0 var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

.leaderboard-content {
  display: flex;
  flex-direction: column;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

/* the viewer's own row, marked by tint rather than a border treatment */
.leaderboard-item.current-user,
.leaderboard-item.current {
  background: var(--color-primary-soft);
  box-shadow: -8px 0 0 var(--color-primary-soft), 8px 0 0 var(--color-primary-soft);
}

.rank {
  flex: 0 0 22px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.rank-number {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

.user,
.user-info {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.username {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaderboard-item.current-user .username,
.leaderboard-item.current .username { font-weight: 700; }

.user-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
}

.stat {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* the spans carry no separator of their own, so they read as one run-on string */
.stat + .stat::before {
  content: '·';
  margin-right: var(--space-2);
  color: var(--color-border-strong);
}

.user-amount,
.amount,
.net {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
  flex: 0 0 auto;
}

.amount.positive, .net.positive, .user-amount.positive { color: var(--color-success); }
.amount.negative, .net.negative, .user-amount.negative { color: var(--color-danger); }

.loading-state,
.empty-state {
  padding: var(--space-5) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.spinner {
  width: 14px;
  height: 14px;
  margin: 0 auto var(--space-2);
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
