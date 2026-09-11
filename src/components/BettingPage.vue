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
      </section>

      <div class="dash">
        <main class="dash-main">

          <OpenBets />

          <TodayResults />

          <section class="board">
            <button
              type="button"
              class="section-head is-toggle"
              :aria-expanded="String(!boardCollapsed)"
              @click="toggleBoard"
            >
              <h2>{{ showingDate === 'tomorrow' ? "Tomorrow's board" : "Today's board" }}</h2>
              <span class="section-meta" v-if="gamesWithBetting.length">
                {{ gamesWithBetting.length }} game{{ gamesWithBetting.length === 1 ? '' : 's' }} with lines
              </span>
              <span class="section-chevron" :class="{ open: !boardCollapsed }" aria-hidden="true"></span>
            </button>

            <template v-if="!boardCollapsed">
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
            </template>
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
import { useCollapsible } from '../composables/useCollapsible.js'
import { API_BASE_URL } from '../config/api.js'
import oddsService from '../services/oddsService.js'
import BetHistory from './BetHistory.vue'
import ParlayHistory from './ParlayHistory.vue'
import OpenBets from './OpenBets.vue'
import TodayResults from './TodayResults.vue'
import GameBoardRow from './GameBoardRow.vue'
import Leaderboard from './Leaderboard.vue'

// The board lists scheduled games at prices the server refreshes daily, and a
// game that kicks off is removed by the local clock rather than by a fetch.
// One request per tick, so this can stay as brisk as it ever was.
const BOARD_REFRESH_MS = 30000
// The other leagues, only to keep the chip row honest. One request each, and
// only for the date already on screen.
const BOARD_SWEEP_MS = 120000
// Drives the "has this game started" filter, so it wants to be finer than the
// fetch cadence. Costs nothing - it's a clock read.
const CLOCK_TICK_MS = 15000

export default {
  name: 'BettingPage',
  components: {
    OpenBets,
    TodayResults,
    GameBoardRow,
    ParlayHistory,
    BetHistory,
    Leaderboard,
  },
  setup() {
    const userStore = useUserStore()
    const { collapsed: boardCollapsed, toggle: toggleBoard } = useCollapsible('boardCollapsed')
    const games = ref([])
    const loading = ref(false)
    const switchingSports = ref(false)
    const error = ref(null)
    const activeLeague = ref('ncaa-football') // Default to NCAA Football
    const refreshInterval = ref(null)
    const sweepInterval = ref(null)
    const userLeaguesForLeaderboard = ref([])
    const gamesBySport = ref({}) // Store games for each sport
    const showingDate = ref('today') // Track if showing 'today' or 'tomorrow'
    const allOdds = ref({}) // Cache all odds data
    // Ticks locally so a game that has kicked off drops off the board on its
    // own. Freshness here is a clock problem, not a network problem - the old
    // 30s poll existed mostly to notice this.
    const now = ref(Date.now())
    const clockInterval = ref(null)
    const lastSeenDay = ref(new Date().toDateString())
    const lastFullPass = ref(Date.now())

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
        // ESPN can lag flipping pre -> in. Trust the kickoff time too, so we
        // never offer a price on a game that has already started.
        const kickoff = Date.parse(game.date || competition?.date || '')
        if (!Number.isNaN(kickoff) && kickoff <= now.value) return false
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
        // null means "we don't know", not "there are no games". A background
        // poll that hits a blip must not blank a board that's already on screen.
        console.error(`Error fetching games for ${sportId} on ${formattedDate}:`, err)
        return null
      }
    }

    // One sport's slate for one date. ok:false is a failed request, which
    // every caller treats as "keep whatever we already had".
    const loadSlate = async (date, sport) => {
      const events = await fetchGamesForDate(date, sport.id)
      if (!events) return { sportId: sport.id, ok: false, hasGames: false, games: [] }

      const withOdds = events.filter(game => {
        const status = game.competitions?.[0]?.status
        if (status?.type?.state !== 'pre') return false
        return gameHasOdds(game, sport.id)
      })
      return { sportId: sport.id, ok: true, hasGames: withOdds.length > 0, games: events }
    }

    // Fold a round of results into gamesBySport, leaving failed sports alone
    // so their league chip doesn't blink out and reflow the controls row.
    const mergeSlates = (results) => {
      results.forEach(result => {
        if (result.ok) gamesBySport.value[result.sportId] = result.games
      })
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
      lastFullPass.value = Date.now()
      
      try {
        // First, ensure we have odds data (refresh it to get latest)
        await fetchAllOdds()
        
        const sportId = activeLeague.value
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        // Check all sports for today's games first
        const todayResults = await Promise.all(sports.value.map(sport => loadSlate(today, sport)))
        
        // If nothing came back at all, this poll learned nothing. Bail rather
        // than read the silence as "no games today" and swing the whole board
        // over to tomorrow's slate.
        if (!todayResults.some(result => result.ok)) return
        
        // Check if ANY sport has games today
        const hasAnyGamesToday = todayResults.some(result => result.hasGames)
        
        if (hasAnyGamesToday) {
          // At least one sport has games today - use today's games
          showingDate.value = 'today'
          const activeSportResult = todayResults.find(r => r.sportId === sportId)
          if (activeSportResult?.ok) games.value = activeSportResult.games
          // Update gamesBySport for all sports
          mergeSlates(todayResults)
        } else {
          // No sports have games today - check tomorrow for all sports
          console.log('No games with odds today across all sports, checking tomorrow')
          showingDate.value = 'tomorrow'
          
          const tomorrowResults = await Promise.all(sports.value.map(sport => loadSlate(tomorrow, sport)))
          const activeSportResult = tomorrowResults.find(r => r.sportId === sportId)
          if (activeSportResult?.ok) games.value = activeSportResult.games
          // Update gamesBySport for all sports
          mergeSlates(tomorrowResults)
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

    // The date whose slate is on screen
    const boardDateValue = () => {
      const date = new Date()
      if (showingDate.value === 'tomorrow') date.setDate(date.getDate() + 1)
      return date
    }

    // Refresh just the league on screen - one request.
    //
    // fetchData checks all four leagues across two dates to work out which has
    // a slate. That answer only changes when the calendar date rolls or the
    // current card runs out, both of which we detect without asking anyone.
    const refreshActiveLeague = async () => {
      const sport = currentSport.value
      if (!sport) return

      // Cheap: oddsService serves this from its own cache and shares any
      // request already open, so polling costs at most one round trip per its
      // 5-minute TTL.
      await fetchAllOdds()

      const slate = await loadSlate(boardDateValue(), sport)
      if (slate.ok) {
        games.value = slate.games
        gamesBySport.value[sport.id] = slate.games
      }
    }

    // The other leagues, for the date already on screen. This is only here to
    // keep the league chips honest, so it skips the active league (just
    // refreshed) and skips the date we already know is empty.
    const sweepOtherLeagues = async () => {
      const others = sports.value.filter(sport => sport.id !== activeLeague.value)
      if (!others.length) return
      const date = boardDateValue()
      mergeSlates(await Promise.all(others.map(sport => loadSlate(date, sport))))
    }

    // No initial fetch here - both callers (mount and setActiveLeague) have
    // just awaited fetchData themselves, and firing a second one meant every
    // page load pulled all four scoreboards twice.
    const startLiveRefresh = () => {
      refreshInterval.value = setInterval(() => {
        refreshActiveLeague()
      }, BOARD_REFRESH_MS)

      sweepInterval.value = setInterval(() => {
        sweepOtherLeagues()
      }, BOARD_SWEEP_MS)
    }

    // Stop live refresh
    const stopLiveRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
      if (sweepInterval.value) {
        clearInterval(sweepInterval.value)
        sweepInterval.value = null
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
      // One pass fills every sport's slate and the active league's board.
      // checkAllSports used to run first and pull the exact same scoreboards
      // that fetchData pulls a moment later, which doubled time-to-content.
      await fetchData(true)
      
      // If current active league doesn't have games, switch to first available.
      // fetchData already has every sport's slate, so this costs no request.
      if (availableSports.value.length > 0) {
        const hasActiveLeagueGames = availableSports.value.some(sport => sport.id === activeLeague.value)
        if (!hasActiveLeagueGames) {
          activeLeague.value = availableSports.value[0].id
          games.value = gamesBySport.value[activeLeague.value] || []
        }
      }
      
      startLiveRefresh()

      // The local clock, not the network, is what tells us the today/tomorrow
      // choice has gone stale: either the calendar date rolled, or the card on
      // screen has emptied out because every game kicked off. Only then is the
      // full cross-league pass worth re-running.
      clockInterval.value = setInterval(() => {
        now.value = Date.now()

        const today = new Date().toDateString()
        const rolled = today !== lastSeenDay.value
        const cardExhausted = showingDate.value === 'today' && gamesWithBetting.value.length === 0

        // An exhausted card doesn't always resolve on the next pass - the
        // active league can be empty while another still has games, which
        // leaves showingDate on 'today' and this condition true. Without a
        // floor that would re-run the full pass every tick.
        const settled = Date.now() - lastFullPass.value < BOARD_SWEEP_MS

        if (rolled || (cardExhausted && !settled)) {
          lastSeenDay.value = today
          fetchData(false)
        }
      }, CLOCK_TICK_MS)
    })

    onUnmounted(() => {
      stopLiveRefresh()
      if (clockInterval.value) clearInterval(clockInterval.value)
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
      boardCollapsed,
      toggleBoard,
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
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--text-lg);
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
}

.ledger-cell {
  flex: 1 1 0;
  min-width: 0;
  /* stats are conditional, so the band can hold anywhere from one cell to
     seven. Uncapped, a lone cell stretches across the whole row. */
  max-width: 240px;
  border-left: 1px solid var(--color-border-strong);
}

/* The headline number takes the display face rather than the mono the rest of
   the band uses — at 3rem+ the mono comma opens a gap you can park a car in,
   and this is the one figure that reads as a headline, not a column. It keeps
   tabular figures from .figure so it still doesn't jitter as the balance moves. */
.ledger-primary-value {
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.9vw, var(--text-display));
  font-weight: var(--display-weight);
  line-height: 1;
  letter-spacing: 0;
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
    /* Column flow turns the cross axis horizontal, so the flex-start above
       would size both children to their content and leave the board floating
       in a dead right-hand gutter. Once the rail is underneath rather than
       beside it, the board gets the whole width. */
    align-items: stretch;
  }

  .dash-rail {
    flex: 1 1 auto;
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
