<template>
  <div class="betting-page">
    <div class="container">

      <!-- Masthead -->
      <header class="page-masthead">
        <div class="masthead-title">
          <h1 class="page-title">Betting Summary</h1>
          <p class="page-description">
            {{ userBalance > 1000 ? "Don't you wish this were real money?" : "Aren't you glad this isnt real money?" }}
          </p>
        </div>
        <div class="masthead-date">
          <span class="eyebrow">{{ boardDate.weekday }}</span>
          <span class="masthead-date-value figure">{{ boardDate.date }}</span>
        </div>
      </header>

      <!-- Ledger band: one rule-divided strip, so it can't re-wrap unevenly
           as conditional stats appear and disappear -->
      <section class="ledger" v-if="userStats">
        <div class="ledger-primary">
          <span class="eyebrow">Available cash</span>
          <span class="ledger-primary-value figure">${{ userBalance.toLocaleString() }}</span>
        </div>
        <div class="ledger-cell" v-if="outstandingBetAmount > 0">
          <span class="eyebrow">Outstanding</span>
          <span class="ledger-value figure">${{ outstandingBetAmount.toLocaleString() }}</span>
        </div>
        <div class="ledger-cell" v-if="userStats.activeBets > 0">
          <span class="eyebrow">Active bets</span>
          <span class="ledger-value figure">{{ userStats.activeBets }}</span>
        </div>
        <div class="ledger-cell" v-if="userStats.winRate > 0">
          <span class="eyebrow">Win rate</span>
          <span class="ledger-value figure" :class="{ positive: userStats.winRate > 50, negative: userStats.winRate < 50 }">{{ userStats.winRate }}%</span>
        </div>
        <div class="ledger-cell">
          <span class="eyebrow">Total bets</span>
          <span class="ledger-value figure">{{ userStats.totalBets }}</span>
        </div>
        <div class="ledger-cell" v-if="userStats.currentStreak !== 0">
          <span class="eyebrow">Streak</span>
          <span class="ledger-value figure" :class="{ positive: userStats.currentStreak > 0, negative: userStats.currentStreak < 0 }">{{ userStats.currentStreak > 0 ? '+' : '' }}{{ userStats.currentStreak }}</span>
        </div>
        <div class="ledger-cell" v-if="winPotential > 0">
          <span class="eyebrow">Win potential</span>
          <span class="ledger-value figure positive">${{ winPotential.toLocaleString() }}</span>
        </div>
        <div class="ledger-cell" v-if="userStats.todaysProfitLoss !== 0">
          <span class="eyebrow">Today P/L</span>
          <span class="ledger-value figure" :class="{ positive: userStats.todaysProfitLoss > 0, negative: userStats.todaysProfitLoss < 0 }">{{ userStats.todaysProfitLoss >= 0 ? '+' : '' }}${{ userStats.todaysProfitLoss.toLocaleString() }}</span>
        </div>
      </section>

      <div class="dash">
        <main class="dash-main">

          <LiveBets />

          <section class="board">
            <div class="section-head">
              <h2>{{ showingDate === 'tomorrow' ? "Tomorrow's board" : "Today's board" }}</h2>
              <span class="section-meta" v-if="gamesWithBetting.length">
                {{ gamesWithBetting.length }} game{{ gamesWithBetting.length === 1 ? '' : 's' }} with lines
              </span>
            </div>

            <div class="board-controls">
              <div class="board-controls-left">
                <div class="league-switch" v-if="availableSports.length">
                  <button
                    v-for="sport in availableSports"
                    :key="sport.id"
                    @click="setActiveLeague(sport.id)"
                    :class="{ active: activeLeague === sport.id }"
                    class="league-chip"
                  >
                    {{ sport.name }}
                  </button>
                </div>
                <p class="board-note">
                  To bet on other dates or leagues, visit Live Scores.
                </p>
              </div>
              <!-- printed once for the whole board rather than per game -->
              <div class="board-market-heads" v-if="gamesWithBetting.length">
                <span>Spread</span>
                <span>Moneyline</span>
                <span>Total</span>
              </div>
            </div>

            <div v-if="error" class="error-message">
              <h3>Could not load games</h3>
              <p>{{ error }}</p>
              <button @click="fetchData" class="retry-btn">Try again</button>
            </div>

            <div v-else-if="switchingSports" class="loading-container">
              <div class="spinner-large"></div>
              <p>Loading {{ currentSport.name }} games…</p>
            </div>

            <div v-else-if="loading && !games.length" class="loading-container">
              <div class="spinner-large"></div>
              <p>Loading games…</p>
            </div>

            <div v-else-if="gamesWithBetting.length === 0" class="no-games">
              <h3>No games with betting lines</h3>
              <p>Nothing is priced for {{ currentSport.name }} right now. Try another league, or check back later.</p>
            </div>

            <div v-else class="board-list">
              <GameBoardRow
                v-for="game in gamesWithBetting"
                :key="game.id"
                :game="game"
                :sport="activeLeague"
              />
            </div>
          </section>

          <BetHistory />
        </main>

        <aside class="dash-rail">
          <ParlayHistory />
          <Leaderboard :user-leagues="userLeaguesForLeaderboard" />
        </aside>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { useUserStore } from '../stores/userStore.js'
import { API_BASE_URL } from '../config/api.js'
import oddsService from '../services/oddsService.js'
import BetHistory from './BetHistory.vue'
import ParlayHistory from './ParlayHistory.vue'
import LiveBets from './LiveBets.vue'
import GameBoardRow from './GameBoardRow.vue'
import Leaderboard from './Leaderboard.vue'

export default {
  name: 'BettingPage',
  components: {
    LiveBets,
    GameBoardRow,
    ParlayHistory,
    BetHistory,
    Leaderboard,
  },
  setup() {
    const userStore = useUserStore()
    const games = ref([])
    const loading = ref(false)
    const switchingSports = ref(false)
    const error = ref(null)
    const activeLeague = ref('ncaa-football') // Default to NCAA Football
    const refreshInterval = ref(null)
    const allSportsRefreshInterval = ref(null)
    const userLeaguesForLeaderboard = ref([])
    const gamesBySport = ref({}) // Store games for each sport
    const showingDate = ref('today') // Track if showing 'today' or 'tomorrow'
    const allOdds = ref({}) // Cache all odds data

    // User data from store
    const userBalance = computed(() => userStore.userBalance.value)
    const userStats = computed(() => userStore.userStats.value)
    
    // Masthead date follows whichever slate is being shown
    const boardDate = computed(() => {
      const d = new Date()
      if (showingDate.value === 'tomorrow') d.setDate(d.getDate() + 1)
      return {
        weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }
    })

    // Calculate outstanding bet amount (sum of all pending bets)
    const outstandingBetAmount = computed(() => {
      if (!userStore.currentUser.value?.bets) return 0
      return userStore.currentUser.value.bets
        .filter(bet => bet.status === 'pending')
        .reduce((total, bet) => total + bet.amount, 0)
    })

    // Calculate win potential (sum of potential winnings from all pending bets)
    const winPotential = computed(() => {
      if (!userStore.currentUser.value?.bets) return 0
      return userStore.currentUser.value.bets
        .filter(bet => bet.status === 'pending')
        .reduce((total, bet) => total + (bet.potentialWin || 0), 0)
    })

    // Check if current user is admin (tannerholle)
    const isAdmin = computed(() => {
      return userStore.currentUser.value?.username === 'tannerholle' || userStore.currentUser.value?.username === 'tanner'
    })

    // Sports configuration
    const sports = ref([
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
      },
      {
        id: 'nfl',
        name: 'NFL',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
      },
      {
        id: 'nba',
        name: 'NBA',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      }
    ])

    const currentSport = computed(() => {
      return sports.value.find(sport => sport.id === activeLeague.value)
    })

    // Format date for ESPN API (YYYYMMDD)
    const formatDateForAPI = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    // Check if a game has odds available. oddsService owns the decision so this
    // filter and the row it renders always agree - see resolveBetting.
    const gameHasOdds = (game, sportId) => {
      return !!oddsService.resolveBetting(allOdds.value, sportId, game)
    }


    // Helper function to check if games have betting available for a specific sport
    // Just checks if there are any scheduled games with odds (no date filtering)
    const hasGamesWithBetting = (sportId, gamesList) => {
      if (!gamesList || gamesList.length === 0) return false
      
      return gamesList.some(game => {
        const competition = game.competitions?.[0]
        const status = competition?.status
        const isScheduled = status?.type?.state === 'pre'
        if (!isScheduled) return false
        return gameHasOdds(game, sportId)
      })
    }

    // Helper function to sort games by rank (for NCAA games)
    const sortGamesByRank = (gamesList) => {
      // Sort by rank for NCAA Football/Basketball
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        const getBestTop25Rank = (game) => {
          const competitors = game.competitions?.[0]?.competitors || []
          const ranks = competitors
            .map(c => c.curatedRank?.current)
            .filter(r => typeof r === 'number' && r >= 1 && r <= 25)
          return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
        }

        return [...gamesList].sort((a, b) => getBestTop25Rank(a) - getBestTop25Rank(b))
      }

      return gamesList
    }

    // Filter games that have betting information and are available for betting,
    // then sort NCAA games by best Top 25 rank (ascending)
    // Shows all scheduled games with odds (no date re-filtering since we already fetched for the correct date)
    const gamesWithBetting = computed(() => {
      const filtered = games.value.filter(game => {
        const competition = game.competitions?.[0]
        const status = competition?.status
        const isScheduled = status?.type?.state === 'pre'
        if (!isScheduled) return false
        return gameHasOdds(game, activeLeague.value)
      })

      return sortGamesByRank(filtered)
    })

    // Filter sports to only show those with games available for betting
    const availableSports = computed(() => {
      return sports.value.filter(sport => {
        const sportGames = gamesBySport.value[sport.id] || []
        return hasGamesWithBetting(sport.id, sportGames)
      })
    })

    // Fetch games for a specific date
    const fetchGamesForDate = async (date, sportId) => {
      const sport = sports.value.find(s => s.id === sportId)
      if (!sport) return []
      
      const formattedDate = formatDateForAPI(date)
      const apiUrl = `${sport.apiUrl}?dates=${formattedDate}`
      
      try {
        const response = await axios.get(apiUrl)
        return response.data.events || []
      } catch (err) {
        console.error(`Error fetching games for ${sportId} on ${formattedDate}:`, err)
        return []
      }
    }

    // Fetch all odds data
    const fetchAllOdds = async () => {
      try {
        allOdds.value = await oddsService.getAllOdds()
      } catch (err) {
        console.error('Error fetching odds:', err)
        allOdds.value = {}
      }
    }

    // Main fetch function: checks all sports for today first, then tomorrow only if NO sports have games today
    const fetchData = async (showLoading = true) => {
      if (showLoading) {
        loading.value = true
      }
      error.value = null
      
      try {
        // First, ensure we have odds data (refresh it to get latest)
        await fetchAllOdds()
        
        const sportId = activeLeague.value
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        // Check all sports for today's games first
        const todayCheckPromises = sports.value.map(async (sport) => {
          try {
            let todayGames = await fetchGamesForDate(today, sport.id)
            let todayGamesWithOdds = todayGames.filter(game => {
              const competition = game.competitions?.[0]
              const status = competition?.status
              const isScheduled = status?.type?.state === 'pre'
              if (!isScheduled) return false
              return gameHasOdds(game, sport.id)
            })
            return { sportId: sport.id, hasGames: todayGamesWithOdds.length > 0, games: todayGames }
          } catch (err) {
            console.error(`Error fetching today's data for ${sport.name}:`, err)
            return { sportId: sport.id, hasGames: false, games: [] }
          }
        })
        
        const todayResults = await Promise.all(todayCheckPromises)
        
        // Check if ANY sport has games today
        const hasAnyGamesToday = todayResults.some(result => result.hasGames)
        
        if (hasAnyGamesToday) {
          // At least one sport has games today - use today's games
          showingDate.value = 'today'
          const activeSportResult = todayResults.find(r => r.sportId === sportId)
          games.value = activeSportResult ? activeSportResult.games : []
          // Update gamesBySport for all sports
          todayResults.forEach(result => {
            gamesBySport.value[result.sportId] = result.games
          })
        } else {
          // No sports have games today - check tomorrow for all sports
          console.log('No games with odds today across all sports, checking tomorrow')
          showingDate.value = 'tomorrow'
          
          const tomorrowCheckPromises = sports.value.map(async (sport) => {
            try {
              const tomorrowGames = await fetchGamesForDate(tomorrow, sport.id)
              const tomorrowGamesWithOdds = tomorrowGames.filter(game => {
                const competition = game.competitions?.[0]
                const status = competition?.status
                const isScheduled = status?.type?.state === 'pre'
                if (!isScheduled) return false
                return gameHasOdds(game, sport.id)
              })
              return { sportId: sport.id, games: tomorrowGames }
            } catch (err) {
              console.error(`Error fetching tomorrow's data for ${sport.name}:`, err)
              return { sportId: sport.id, games: [] }
            }
          })
          
          const tomorrowResults = await Promise.all(tomorrowCheckPromises)
          const activeSportResult = tomorrowResults.find(r => r.sportId === sportId)
          games.value = activeSportResult ? activeSportResult.games : []
          // Update gamesBySport for all sports
          tomorrowResults.forEach(result => {
            gamesBySport.value[result.sportId] = result.games
          })
        }
        
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
      } finally {
        if (showLoading) {
          loading.value = false
        }
      }
    }

    // Check all sports to see which have games available (today or tomorrow)
    // Only checks tomorrow if NO sports have games today
    const checkAllSports = async () => {
      // Ensure we have odds data
      if (Object.keys(allOdds.value).length === 0) {
        await fetchAllOdds()
      }
      
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      // First, check all sports for today's games
      const todayCheckPromises = sports.value.map(async (sport) => {
        try {
          let todayGames = await fetchGamesForDate(today, sport.id)
          let todayGamesWithOdds = todayGames.filter(game => {
            const competition = game.competitions?.[0]
            const status = competition?.status
            const isScheduled = status?.type?.state === 'pre'
            if (!isScheduled) return false
            return gameHasOdds(game, sport.id)
          })
          return { sportId: sport.id, hasGames: todayGamesWithOdds.length > 0, games: todayGames }
        } catch (err) {
          console.error(`Error fetching today's data for ${sport.name}:`, err)
          return { sportId: sport.id, hasGames: false, games: [] }
        }
      })
      
      const todayResults = await Promise.all(todayCheckPromises)
      
      // Check if ANY sport has games today
      const hasAnyGamesToday = todayResults.some(result => result.hasGames)
      
      if (hasAnyGamesToday) {
        // At least one sport has games today - store today's games for all sports
        todayResults.forEach(result => {
          gamesBySport.value[result.sportId] = result.games
        })
      } else {
        // No sports have games today - check tomorrow for all sports
        console.log('No games with odds today across all sports, checking tomorrow')
        const tomorrowCheckPromises = sports.value.map(async (sport) => {
          try {
            const tomorrowGames = await fetchGamesForDate(tomorrow, sport.id)
            const tomorrowGamesWithOdds = tomorrowGames.filter(game => {
              const competition = game.competitions?.[0]
              const status = competition?.status
              const isScheduled = status?.type?.state === 'pre'
              if (!isScheduled) return false
              return gameHasOdds(game, sport.id)
            })
            return { sportId: sport.id, games: tomorrowGames }
          } catch (err) {
            console.error(`Error fetching tomorrow's data for ${sport.name}:`, err)
            return { sportId: sport.id, games: [] }
          }
        })
        
        const tomorrowResults = await Promise.all(tomorrowCheckPromises)
        tomorrowResults.forEach(result => {
          gamesBySport.value[result.sportId] = result.games
        })
      }
    }

    const setActiveLeague = async (league) => {
      if (activeLeague.value === league) return // Already on this sport
      
      activeLeague.value = league
      switchingSports.value = true
      // Clear games immediately so old games don't show
      games.value = []
      
      // Restart refresh with new league
      stopLiveRefresh()
      
      try {
        // Fetch data for the new sport
        await fetchData(true)
      } catch (err) {
        console.error('Error switching sports:', err)
        error.value = err.message || 'Failed to load games'
      } finally {
        switchingSports.value = false
        startLiveRefresh()
      }
    }

    // Start periodic refresh for live games
    const startLiveRefresh = () => {
      // Initial fetch with loading
      fetchData(true)
      
      // Set up interval to refresh every 30 seconds (without loading indicator)
      // This also refreshes odds data to catch new games
      refreshInterval.value = setInterval(() => {
        fetchData(false)
      }, 30000)
    }

    // Stop live refresh
    const stopLiveRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    // Start periodic refresh for all sports (to update available sports list)
    const startAllSportsRefresh = () => {
      // Check all sports every 5 minutes to update availability
      // Also refresh odds data periodically
      allSportsRefreshInterval.value = setInterval(async () => {
        await fetchAllOdds()
        await checkAllSports()
      }, 300000) // 5 minutes
    }

    // Stop all sports refresh
    const stopAllSportsRefresh = () => {
      if (allSportsRefreshInterval.value) {
        clearInterval(allSportsRefreshInterval.value)
        allSportsRefreshInterval.value = null
      }
    }

    const fetchUserLeagues = async () => {
      if (!userStore.currentUser.value?.username) return
      
      try {
        const response = await axios.get(`${API_BASE_URL}/user/${userStore.currentUser.value.username}/leagues`)
        userLeaguesForLeaderboard.value = response.data || []
      } catch (error) {
        console.error('Error fetching user leagues:', error)
        userLeaguesForLeaderboard.value = []
      }
    }

    onMounted(async () => {
      await fetchUserLeagues()
      // Fetch odds data first
      await fetchAllOdds()
      // Check all sports first to see which have games available
      await checkAllSports()
      
      // If current active league doesn't have games, switch to first available
      if (availableSports.value.length > 0) {
        const hasActiveLeagueGames = availableSports.value.some(sport => sport.id === activeLeague.value)
        if (!hasActiveLeagueGames) {
          activeLeague.value = availableSports.value[0].id
        }
      }
      
      startLiveRefresh()
      startAllSportsRefresh()
    })

    onUnmounted(() => {
      stopLiveRefresh()
      stopAllSportsRefresh()
    })

    return {
      games,
      loading,
      switchingSports,
      error,
      activeLeague,
      sports,
      availableSports,
      currentSport,
      gamesWithBetting,
      userBalance,
      userStats,
      outstandingBetAmount,
      winPotential,
      isAdmin,
      fetchData,
      setActiveLeague,
      userLeaguesForLeaderboard,
      boardDate,
      showingDate,
    }
  }
}
</script>

<style scoped>
.betting-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding-bottom: var(--space-12);
}

/* ── Masthead ── */
.page-masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-8) 0 var(--space-5);
}

.masthead-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.page-title {
  margin: 0;
  font-size: var(--text-display);
  line-height: 1;
  color: var(--color-text);
}

.page-description {
  margin: 0;
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--text-xl);
  color: var(--color-text-muted);
}

.masthead-date {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: 0 0 auto;
}

.masthead-date-value {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Ledger band ──
   Replaces the old floating stat cards. Those were a centred flex row of
   min-width:150px cards whose members render conditionally, so the row
   re-wrapped into a different shape depending on which stats existed. One
   strip divided by rules can't do that. */
.ledger {
  display: flex;
  align-items: stretch;
  background: var(--color-surface-muted);
  border-top: 2px solid var(--color-text);
  border-bottom: 1px solid var(--color-border-strong);
}

.ledger-primary,
.ledger-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  /* Side padding is the first thing to give when the band gets tight. */
  padding: var(--space-5) clamp(var(--space-3), 1.4vw, var(--space-5));
  min-width: 0;
}

.ledger-primary {
  /* 260px is the width it wants, not a floor. A fixed basis here was what
     pushed the band past the page and turned it into a sideways scroll. */
  flex: 0 1 260px;
  padding-left: 0;
}

.ledger-cell {
  flex: 1 1 0;
  min-width: 0;
  /* stats are conditional, so the band can hold anywhere from one cell to
     seven. Uncapped, a lone cell stretches across the whole row. */
  max-width: 240px;
  border-left: 1px solid var(--color-border-strong);
}

.ledger-primary-value {
  font-size: clamp(1.75rem, 3.4vw, var(--text-display));
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.ledger-value {
  font-size: clamp(1.0625rem, 1.9vw, var(--text-2xl));
  font-weight: 500;
  line-height: 1.1;
  color: var(--color-text);
}

.ledger-value.positive { color: var(--color-success); }
.ledger-value.negative { color: var(--color-danger); }

/* ── Two-column body ── */
.dash {
  display: flex;
  gap: var(--space-8);
  align-items: flex-start;
  padding: var(--space-8) 0;
}

.dash-main {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.dash-rail {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  position: sticky;
  top: var(--space-5);
}

/* ── Board ── */
.board {
  display: flex;
  flex-direction: column;
}

.board-controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0 var(--space-2);
}

/* A segmented control. The old chips were 50px-radius glass pills with a
   backdrop blur and a sweep animation, which only read against the gradient. */
.league-switch {
  display: flex;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.league-chip {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-left: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.league-chip:first-child { border-left: none; }

.league-chip:hover { background: var(--color-surface-muted); color: var(--color-text); }

.league-chip.active {
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.board-controls-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

.board-note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

/* aligned to GameBoardRow's 448px odds column */
.board-market-heads {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  width: 448px;
  flex: 0 0 auto;
}

.board-market-heads span {
  text-align: center;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

/* Cards carry a full-width odds layout, so one column reads better than two */
/* Deliberately NOT .games-grid — that class belongs to the scoreboard's 2-up
   card grid in style.css, whose `align-items: start` leaked in here and stopped
   these rows stretching, so every row sized its columns to its own team names
   and no two boards lined up. GameBoardRow draws its own bottom rule, so the
   list needs no gap. */
.board-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-top: 1px solid var(--color-border);
}

/* ── States ── */
.error-message,
.loading-container,
.no-games {
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.error-message {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
}

/* ── Responsive ── */
@media (max-width: 1180px) {
  .dash {
    flex-direction: column;
  }

  .dash-rail {
    flex: 1 1 auto;
    width: 100%;
    position: static;
  }
}

@media (max-width: 900px) {
  .page-masthead {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding-top: var(--space-6);
  }

  .masthead-date {
    align-items: flex-start;
  }

  .page-title { font-size: var(--text-3xl); }
  .page-description { font-size: var(--text-lg); }

  /* Everything on the band stays on the band - it scales down to fit rather
     than hiding stats behind a sideways scroll. */
  .ledger-primary,
  .ledger-cell {
    padding-top: var(--space-4);
    padding-bottom: var(--space-4);
  }

  .ledger-primary { flex: 0 1 auto; }

  .ledger-cell { max-width: none; }

  .ledger .eyebrow { letter-spacing: 0.08em; }

  .board-controls {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .board-market-heads { display: none; }

  .league-switch { overflow-x: auto; }

  .board-note { text-align: left; }
}

/* Below this the cells are narrower than the figures in them, so the band wraps
   into rows instead of shrinking further. Still no sideways scroll. */
@media (max-width: 560px) {
  .ledger {
    flex-wrap: wrap;
  }

  .ledger-primary {
    flex: 1 1 100%;
    padding-bottom: var(--space-3);
  }

  .ledger-cell {
    flex: 1 1 33%;
    border-top: 1px solid var(--color-border-strong);
  }
}

</style>
