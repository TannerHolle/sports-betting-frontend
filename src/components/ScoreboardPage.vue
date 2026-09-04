<template>
  <div class="scoreboard-page">
    <!-- One control band. The league tabs and the filter row used to be two
         separate full-width bands under the nav; together with the nav that put
         188px of chrome above the first score. -->
    <div class="board-bar">
      <div class="container board-bar-row">
        <div class="board-bar-left">
          <div class="sport-switch">
            <button
              v-for="sport in sports"
              :key="sport.id"
              @click="setActiveLeague(sport.id)"
              :class="{ active: activeLeague === sport.id }"
              class="sport-chip"
            >
              {{ sport.name }}
            </button>
          </div>
          <span class="board-tally" v-if="filteredGames.length">
            <template v-if="liveCount">
              <span class="tally-dot" aria-hidden="true"></span>
              <span class="eyebrow tally-live">{{ liveCount }} live</span>
              <span class="tally-sep" aria-hidden="true">&middot;</span>
            </template>
            <span class="eyebrow">{{ upcomingCount }} upcoming</span>
          </span>
        </div>

        <div class="board-bar-right">
          <label class="visually-hidden" for="sb-filter">Filter games</label>
          <select id="sb-filter" v-model="selectedFilter" class="board-chip board-select">
            <option
              v-for="filter in currentSportFilters"
              :key="filter.value"
              :value="filter.value"
            >
              {{ filter.label }}
            </option>
          </select>

          <!-- The native date input showed an empty mm/dd/yyyy while the board
               was showing today. A stepper states the day and makes the common
               move - one day either way - a single click. -->
          <div class="date-stepper">
            <button class="date-step" @click="stepDate(-1)" aria-label="Previous day">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="date-value figure" @click="openDatePicker">
              {{ dateLabel }}<span class="date-short" v-if="dateShort">{{ dateShort }}</span>
            </button>
            <input
              ref="dateInput"
              v-model="selectedDate"
              type="date"
              class="date-native"
              tabindex="-1"
              aria-hidden="true"
            />
            <button class="date-step" @click="stepDate(1)" aria-label="Next day">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <main class="main">
      <div class="container">
        <div v-if="error" class="error-message">
          <h3>Could not load data</h3>
          <p>{{ error }}</p>
          <button @click="fetchData" class="retry-btn">Try Again</button>
        </div>

        <div v-else-if="loading && !games.length" class="loading-container">
          <div class="spinner-large"></div>
          <p>Loading games...</p>
        </div>

        <div v-else-if="filteredGames.length === 0" class="no-games">
          <div class="no-games-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <rect x="3.5" y="6.5" width="25" height="19" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M3.5 12.5h25M11 6.5v19M21 6.5v19" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
          <h3>{{ emptyStateTitle }}</h3>
          <p>{{ emptyStateMessage }}</p>
        </div>

        <div v-else class="games-grid">
          <component 
            :is="currentGameCardComponent"
            v-for="game in filteredGames" 
            :key="game.id" 
            :game="game" 
            :sport="activeLeague"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import NCAAFootballCard from './NCAAFootballCard.vue'
import NFLGameCard from './NFLGameCard.vue'
import CollegeBasketballCard from './CollegeBasketballCard.vue'
import NBAGameCard from './NBAGameCard.vue'

export default {
  name: 'ScoreboardPage',
  components: {
    NCAAFootballCard,
    NFLGameCard,
    CollegeBasketballCard,
    NBAGameCard
  },
  setup() {
    const games = ref([])
    const loading = ref(false)
    const error = ref(null)
    const refreshInterval = ref(null)
    const selectedFilter = ref(localStorage.getItem('selectedFilter') || 'top25')
    const selectedDate = ref('')
    const activeLeague = ref(localStorage.getItem('activeLeague') || 'ncaa-football')

    // Sports configuration
    const sports = ref([
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
        component: 'NCAAFootballCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'top25', label: 'Top 25 Only' },
          { value: 'sec', label: 'SEC' },
          { value: 'big10', label: 'Big Ten' },
          { value: 'acc', label: 'ACC' },
          { value: 'big12', label: 'Big 12' },
          { value: 'mountainwest', label: 'Mountain West' },
          { value: 'american', label: 'American Athletic' }
        ]
      },
      {
        id: 'nfl',
        name: 'NFL',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        component: 'NFLGameCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'afc', label: 'AFC' },
          { value: 'nfc', label: 'NFC' },
          { value: 'afc-east', label: 'AFC East' },
          { value: 'afc-west', label: 'AFC West' },
          { value: 'afc-north', label: 'AFC North' },
          { value: 'afc-south', label: 'AFC South' },
          { value: 'nfc-east', label: 'NFC East' },
          { value: 'nfc-west', label: 'NFC West' },
          { value: 'nfc-north', label: 'NFC North' },
          { value: 'nfc-south', label: 'NFC South' }
        ]
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
        component: 'CollegeBasketballCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'top25', label: 'Top 25 Only' },
          { value: 'acc', label: 'ACC' },
          { value: 'big10', label: 'Big Ten' },
          { value: 'big12', label: 'Big 12' },
          { value: 'sec', label: 'SEC' },
          { value: 'big-east', label: 'Big East' }
        ]
      },
      {
        id: 'nba',
        name: 'NBA',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        component: 'NBAGameCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'east', label: 'Eastern Conference' },
          { value: 'west', label: 'Western Conference' },
          { value: 'atlantic', label: 'Atlantic Division' },
          { value: 'central', label: 'Central Division' },
          { value: 'southeast', label: 'Southeast Division' },
          { value: 'northwest', label: 'Northwest Division' },
          { value: 'pacific', label: 'Pacific Division' },
          { value: 'southwest', label: 'Southwest Division' }
        ]
      }
    ])

    const currentSport = computed(() => {
      return sports.value.find(sport => sport.id === activeLeague.value)
    })

    const currentSportFilters = computed(() => {
      return currentSport.value?.filters || []
    })

    const currentGameCardComponent = computed(() => {
      return currentSport.value?.component || 'NCAAFootballCard'
    })

    const emptyStateTitle = computed(() => {
      if (games.value.length === 0) {
        return 'No games scheduled'
      }
      return 'No games match your filters'
    })

    const emptyStateMessage = computed(() => {
      // Helper function to format date without timezone issues
      const formatDate = (dateString) => {
        if (!dateString) return ''
        // Parse YYYY-MM-DD format directly to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      }

      if (games.value.length === 0) {
        if (selectedDate.value) {
          const formattedDate = formatDate(selectedDate.value)
          return `There are no games scheduled for ${formattedDate}.`
        }
        return 'There are no games scheduled for the selected date.'
      }
      
      // Games exist but don't match filter
      const filterLabel = currentSportFilters.value.find(f => f.value === selectedFilter.value)?.label || 'your filter'
      
      if (selectedDate.value) {
        const formattedDate = formatDate(selectedDate.value)
        return `No games match the "${filterLabel}" filter for ${formattedDate}. Try selecting a different filter or date.`
      }
      
      return `No games match the "${filterLabel}" filter. Try selecting a different filter or date.`
    })

    const filteredGames = computed(() => {
      if (!games.value.length) return []
      
      const filtered = games.value.filter(game => {
        const competition = game.competitions?.[0]
        if (!competition) return false
        
        const competitors = competition.competitors || []
        const groups = competition.groups
        
        // Handle filtering based on current sport
        switch (activeLeague.value) {
          case 'ncaa-football':
            return filterNCAAFootballGames(competitors, groups, selectedFilter.value)
          case 'nfl':
            return filterNFLGames(competitors, selectedFilter.value)
          case 'ncaa-basketball':
            return filterNCAABasketballGames(competitors, groups, selectedFilter.value)
          default:
            return true
        }
      })

      // Only apply live game sorting for NCAA sports (college football and basketball)
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        // Helper function to get best rank for a game (lower number = higher rank)
        const getBestRank = (game) => {
          const competitors = game.competitions?.[0]?.competitors || []
          const ranks = competitors
            .map(c => c.curatedRank?.current)
            .filter(r => typeof r === 'number' && r >= 1 && r <= 25)
          return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
        }

        // Helper function to check if game is live
        const isLiveGame = (game) => {
          const status = game.competitions?.[0]?.status
          return status?.type?.state === 'in'
        }

        // Separate live and non-live games
        const liveGames = filtered.filter(isLiveGame)
        const nonLiveGames = filtered.filter(game => !isLiveGame(game))

        // Sort live games by highest rank first (lowest rank number)
        const sortedLiveGames = [...liveGames].sort((a, b) => {
          const rankA = getBestRank(a)
          const rankB = getBestRank(b)
          return rankA - rankB
        })

        // Sort non-live games by rank
        const sortedNonLiveGames = [...nonLiveGames].sort((a, b) => {
          const rankA = getBestRank(a)
          const rankB = getBestRank(b)
          return rankA - rankB
        })

        // Return live games first, then non-live games
        return [...sortedLiveGames, ...sortedNonLiveGames]
      }

      // For NFL and NBA, return filtered games without live game prioritization
      return filtered
    })

    // Format date for ESPN API (YYYYMMDD)
    const dateInput = ref(null)

    // selectedDate is '' for "whatever ESPN calls today", which is what the
    // page loads with. The stepper needs a concrete day to move from.
    const isoOf = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const activeDate = computed(() => {
      if (!selectedDate.value) return new Date()
      const [year, month, day] = selectedDate.value.split('-').map(Number)
      return new Date(year, month - 1, day)
    })

    // Today, Yesterday and Tomorrow are the three the label can say better than
    // a date can; everything else gets the weekday.
    const dateLabel = computed(() => {
      const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const days = Math.round((midnight(activeDate.value) - midnight(new Date())) / 86400000)
      if (days === 0) return 'Today'
      if (days === -1) return 'Yesterday'
      if (days === 1) return 'Tomorrow'
      return activeDate.value.toLocaleDateString('en-US', { weekday: 'short' })
    })

    const dateShort = computed(() =>
      activeDate.value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )

    const stepDate = (days) => {
      const next = new Date(activeDate.value)
      next.setDate(next.getDate() + days)
      selectedDate.value = isoOf(next)
    }

    // The native picker is still the picker - it is just driven from the
    // stepper's middle segment instead of being the control itself.
    const openDatePicker = () => {
      const el = dateInput.value
      if (!el) return
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker()
          return
        } catch {
          // showPicker throws if the browser wants a closer user gesture
        }
      }
      el.focus()
      el.click()
    }

    const liveCount = computed(() =>
      filteredGames.value.filter(g => g.competitions?.[0]?.status?.type?.state === 'in').length
    )

    const upcomingCount = computed(() =>
      filteredGames.value.filter(g => g.competitions?.[0]?.status?.type?.state === 'pre').length
    )

    const formatDateForAPI = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const fetchData = async () => {
      loading.value = true
      error.value = null
      
      try {
        const baseApiUrl = currentSport.value?.apiUrl
        
        if (!baseApiUrl) {
          throw new Error('No API URL configured for current sport')
        }
        
        // Add date parameter
        let apiUrl = baseApiUrl
        if (selectedDate.value) {
          // If a date is explicitly selected, use it
          const formattedDate = selectedDate.value.replace(/-/g, '')
          apiUrl = `${baseApiUrl}?dates=${formattedDate}`
        } else if (activeLeague.value === 'nba' || activeLeague.value === 'ncaa-basketball') {
          // For NBA and college basketball, always include current date to avoid getting yesterday's games in early morning
          const currentDate = new Date()
          const formattedDate = formatDateForAPI(currentDate)
          apiUrl = `${baseApiUrl}?dates=${formattedDate}`
        }
        
        const response = await axios.get(apiUrl)
        games.value = response.data.events || []
        
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
        console.error('Error details:', err.response?.data || err.message)
      } finally {
        loading.value = false
      }
    }

    // Watch for filter changes and save to localStorage
    watch(selectedFilter, (newFilter) => {
      localStorage.setItem('selectedFilter', newFilter)
    })

    // Watch for date changes and fetch new data
    watch(selectedDate, () => {
      // Fetch new data when date changes
      fetchData()
    })

    const setActiveLeague = (league) => {
      activeLeague.value = league
      localStorage.setItem('activeLeague', league) // Save to localStorage
      
      // Set appropriate default filter for each sport
      if (league === 'ncaa-football' || league === 'ncaa-basketball') {
        selectedFilter.value = 'top25' // NCAA Football and Basketball default to Top 25
      } else {
        selectedFilter.value = 'all' // NFL defaults to All Games
      }
      
      // Reset loading state
      loading.value = false
      
      fetchData() // Fetch data for the new league
    }

    // Filtering functions
    const filterNCAAFootballGames = (competitors, groups, filter) => {
      switch (filter) {
        case 'all':
          return true
        case 'top25':
          return competitors.some(comp => 
            comp.curatedRank && comp.curatedRank.current <= 25
          )
        case 'sec':
          return groups?.id === '8' || groups?.shortName === 'SEC'
        case 'big10':
          return groups?.id === '5' || groups?.shortName === 'Big Ten'
        case 'acc':
          return groups?.id === '1' || groups?.shortName === 'ACC'
        case 'big12':
          return groups?.id === '4' || groups?.shortName === 'Big 12'
        case 'mountainwest':
          return groups?.id === '17' || groups?.shortName === 'Mountain West'
        case 'american':
          return groups?.id === '151' || groups?.shortName === 'American'
        default:
          return true
      }
    }

    const filterNFLGames = (competitors, filter) => {
      switch (filter) {
        case 'afc':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCTeam(teamName)
          })
        case 'nfc':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCTeam(teamName)
          })
        case 'afc-east':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCEastTeam(teamName)
          })
        case 'afc-west':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCWestTeam(teamName)
          })
        case 'afc-north':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCNorthTeam(teamName)
          })
        case 'afc-south':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCSouthTeam(teamName)
          })
        case 'nfc-east':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCEastTeam(teamName)
          })
        case 'nfc-west':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCWestTeam(teamName)
          })
        case 'nfc-north':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCNorthTeam(teamName)
          })
        case 'nfc-south':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCSouthTeam(teamName)
          })
        default:
          return true
      }
    }

    const filterNCAABasketballGames = (competitors, groups, filter) => {
      switch (filter) {
        case 'all':
          return true
        case 'top25':
          return competitors.some(comp => 
            comp.curatedRank && comp.curatedRank.current <= 25
          )
        case 'acc':
          return competitors.some(comp => comp.team?.conferenceId === '16')
        case 'big10':
          return competitors.some(comp => comp.team?.conferenceId === '7')
        case 'big12':
          return competitors.some(comp => comp.team?.conferenceId === '8')
        case 'sec':
          return competitors.some(comp => comp.team?.conferenceId === '23')
        case 'big-east':
          return competitors.some(comp => comp.team?.conferenceId === '4')
        default:
          return true
      }
    }

    // NFL Team Classification Functions
    const isAFCTeam = (teamName) => {
      const afcTeams = ['BUF', 'MIA', 'NE', 'NYJ', 'BAL', 'CIN', 'CLE', 'PIT', 'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'KC', 'LV', 'LAC']
      return afcTeams.includes(teamName.toUpperCase())
    }

    const isNFCTeam = (teamName) => {
      const nfcTeams = ['DAL', 'NYG', 'PHI', 'WAS', 'CHI', 'DET', 'GB', 'MIN', 'ATL', 'CAR', 'NO', 'TB', 'ARI', 'LAR', 'SF', 'SEA']
      return nfcTeams.includes(teamName.toUpperCase())
    }

    const isAFCEastTeam = (teamName) => {
      const afcEastTeams = ['BUF', 'MIA', 'NE', 'NYJ']
      return afcEastTeams.includes(teamName.toUpperCase())
    }

    const isAFCWestTeam = (teamName) => {
      const afcWestTeams = ['DEN', 'KC', 'LV', 'LAC']
      return afcWestTeams.includes(teamName.toUpperCase())
    }

    const isAFCNorthTeam = (teamName) => {
      const afcNorthTeams = ['BAL', 'CIN', 'CLE', 'PIT']
      return afcNorthTeams.includes(teamName.toUpperCase())
    }

    const isAFCSouthTeam = (teamName) => {
      const afcSouthTeams = ['HOU', 'IND', 'JAX', 'TEN']
      return afcSouthTeams.includes(teamName.toUpperCase())
    }

    const isNFCEastTeam = (teamName) => {
      const nfcEastTeams = ['DAL', 'NYG', 'PHI', 'WAS']
      return nfcEastTeams.includes(teamName.toUpperCase())
    }

    const isNFCWestTeam = (teamName) => {
      const nfcWestTeams = ['ARI', 'LAR', 'SF', 'SEA']
      return nfcWestTeams.includes(teamName.toUpperCase())
    }

    const isNFCNorthTeam = (teamName) => {
      const nfcNorthTeams = ['CHI', 'DET', 'GB', 'MIN']
      return nfcNorthTeams.includes(teamName.toUpperCase())
    }

    const isNFCSouthTeam = (teamName) => {
      const nfcSouthTeams = ['ATL', 'CAR', 'NO', 'TB']
      return nfcSouthTeams.includes(teamName.toUpperCase())
    }

    // Polling ESPN. Only refresh quickly while a game is actually in progress,
    // and stop entirely while the tab is hidden - this used to hit ESPN every
    // 10 seconds forever, including overnight and in background tabs.
    const LIVE_REFRESH_MS = 10000
    const IDLE_REFRESH_MS = 60000

    const hasLiveGame = () => games.value.some(
      game => game.competitions?.[0]?.status?.type?.state === 'in'
    )

    const scheduleRefresh = () => {
      stopAutoRefresh()
      if (typeof document !== 'undefined' && document.hidden) return

      refreshInterval.value = setTimeout(async () => {
        await fetchData()
        scheduleRefresh()
      }, hasLiveGame() ? LIVE_REFRESH_MS : IDLE_REFRESH_MS)
    }

    const startAutoRefresh = () => {
      scheduleRefresh()
    }

    const stopAutoRefresh = () => {
      if (refreshInterval.value) {
        clearTimeout(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAutoRefresh()
      } else {
        // Catch up on whatever was missed while hidden, then resume
        fetchData()
        scheduleRefresh()
      }
    }

    onMounted(() => {
      // Ensure college sports default to 'top25' filter on initial load if no preference is saved
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        if (!localStorage.getItem('selectedFilter')) {
          selectedFilter.value = 'top25'
        }
      }
      fetchData()
      startAutoRefresh()
      document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onUnmounted(() => {
      stopAutoRefresh()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    return {
      games,
      loading,
      error,
      selectedFilter,
      selectedDate,
      filteredGames,
      activeLeague,
      sports,
      currentSport,
      currentSportFilters,
      currentGameCardComponent,
      emptyStateTitle,
      emptyStateMessage,
      fetchData,
      setActiveLeague,
      dateInput,
      dateLabel,
      dateShort,
      stepDate,
      openDatePicker,
      liveCount,
      upcomingCount
    }
  }
}
</script>

<style scoped>
.board-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-strong);
  /* Sits under the 66px nav so switching sport or day never needs a scroll
     back to the top of a long slate. */
  position: sticky;
  top: 66px;
  z-index: 90;
}

.board-bar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

.board-bar-left,
.board-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}

.board-bar-right {
  gap: var(--space-2);
  flex: 0 0 auto;
}

/* Same switch as the betting board's league chips: hugs its buttons instead of
   stretching four tabs across the container. */
.sport-switch {
  display: inline-flex;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  flex: 0 0 auto;
}

.sport-chip {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-left: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.sport-chip:first-child { border-left: none; }

.sport-chip:hover { background: var(--color-surface-muted); color: var(--color-text); }

.sport-chip.active {
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.board-tally {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.tally-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  flex: 0 0 auto;
}

.tally-live { color: var(--color-text-muted); }

.tally-sep { color: var(--color-text-subtle); }

.board-chip {
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
}

.board-select {
  min-width: 0;
  max-width: 200px;
}

.board-chip:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.date-stepper {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  height: 32px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
}

.date-step,
.date-value {
  border: none;
  background: var(--color-surface);
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.date-step {
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
}

.date-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border-left: 1px solid var(--color-border-strong);
  border-right: 1px solid var(--color-border-strong);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
}

.date-short { color: var(--color-text-subtle); }

.date-step:hover,
.date-value:hover { background: var(--color-surface-muted); color: var(--color-text); }

.date-step:focus-visible,
.date-value:focus-visible {
  outline: none;
  box-shadow: inset var(--shadow-focus);
}

/* The real input still owns parsing and the calendar; it just isn't the
   control any more. */
.date-native {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .board-bar {
    position: static;
  }

  .board-bar-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  /* Full-width switch on narrow screens, the way the Leagues tabs go.
     flex:1 shares the leftover space but never shrinks a chip below its own
     label, so "NCAA Basketball" keeps its width and the short ones give. */
  .sport-switch {
    display: flex;
    width: 100%;
  }

  .sport-chip {
    flex: 1;
    padding: var(--space-2) var(--space-2);
    text-align: center;
  }

  /* The tally goes first when the bar stacks: it cost a whole row, and the
     slate underneath already shows what is live. */
  .board-tally {
    display: none;
  }

  /* Filter grows, date sits at the right edge - the two controls span the
     width instead of huddling on one side. */
  .board-bar-right {
    justify-content: space-between;
  }

  .board-select {
    max-width: none;
    flex: 1;
  }
}

</style>


