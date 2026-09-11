<template>
  <div class="advanced-stats">
    <div v-if="stats && stats.availableSports && stats.availableSports.length > 0" class="stats-content">
      <!-- Bottom line. Win rate alone was the old headline, which is the
           wrong number to lead with: at -110 a 50% record loses money. -->
      <div class="stats-section">
        <div class="section-header">
          <h4>Bottom line</h4>
          <div class="section-filter" v-if="stats.availableSports && stats.availableSports.length > 0">
            <label for="sport-select">Sport</label>
            <select id="sport-select" v-model="selectedSport" @change="onSportChange" class="sport-select">
              <option value="all">All sports</option>
              <option v-for="sport in stats.availableSports" :key="sport" :value="sport">
                {{ formatSportName(sport) }}
              </option>
            </select>
          </div>
        </div>

        <div class="ledger-strip">
          <div class="ls-cell ls-lead">
            <span class="ls-key">Net</span>
            <span class="ls-val figure" :class="signClass(overall.profit)">{{ money(overall.profit) }}</span>
          </div>
          <div class="ls-cell">
            <span class="ls-key">Return</span>
            <span class="ls-val figure" :class="signClass(overall.roi)">{{ pct(overall.roi, true) }}</span>
          </div>
          <div class="ls-cell">
            <span class="ls-key">Wagered</span>
            <span class="ls-val figure">${{ Math.round(overall.wagered).toLocaleString() }}</span>
          </div>
          <div class="ls-cell">
            <span class="ls-key">Settled</span>
            <span class="ls-val figure">{{ overall.settled }}</span>
          </div>
          <div class="ls-cell">
            <span class="ls-key">Win rate</span>
            <span class="ls-val figure">{{ pct(overall.winRate) }}</span>
          </div>
          <div class="ls-cell">
            <span class="ls-key">Needed</span>
            <span class="ls-val figure">{{ pct(overall.breakEven) }}</span>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h4>By market</h4>
        <p class="section-note">Win rate only means something next to the rate the price demanded. <strong>Edge</strong> is the gap between them.</p>
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr>
                <th class="t-left">Market</th>
                <th>Record</th>
                <th>Win rate</th>
                <th>Needed</th>
                <th>Edge</th>
                <th>Net</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in byMarket" :key="row.key">
                <td class="t-left t-name">{{ row.label }}</td>
                <td class="figure">{{ row.won }}-{{ row.lost }}<span v-if="row.push">-{{ row.push }}</span></td>
                <td class="figure">{{ pct(row.winRate) }}</td>
                <td class="figure t-muted">{{ pct(row.breakEven) }}</td>
                <td class="figure" :class="signClass(row.edge)">{{ pct(row.edge, true) }}</td>
                <td class="figure" :class="signClass(row.profit)">{{ money(row.profit) }}</td>
                <td class="figure" :class="signClass(row.roi)">{{ pct(row.roi, true) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="stats-section" v-if="bySport.length > 1">
        <h4>By sport</h4>
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr>
                <th class="t-left">Sport</th>
                <th>Record</th>
                <th>Win rate</th>
                <th>Needed</th>
                <th>Edge</th>
                <th>Net</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in bySport" :key="row.key">
                <td class="t-left t-name">{{ row.label }}</td>
                <td class="figure">{{ row.won }}-{{ row.lost }}<span v-if="row.push">-{{ row.push }}</span></td>
                <td class="figure">{{ pct(row.winRate) }}</td>
                <td class="figure t-muted">{{ pct(row.breakEven) }}</td>
                <td class="figure" :class="signClass(row.edge)">{{ pct(row.edge, true) }}</td>
                <td class="figure" :class="signClass(row.profit)">{{ money(row.profit) }}</td>
                <td class="figure" :class="signClass(row.roi)">{{ pct(row.roi, true) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="stats-section" v-if="bySide.length">
        <h4>Which side you take</h4>
        <p class="section-note">Knowing you lean one way is only half of it — this is whether leaning that way pays.</p>
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr>
                <th class="t-left">Side</th>
                <th>Record</th>
                <th>Win rate</th>
                <th>Needed</th>
                <th>Edge</th>
                <th>Net</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in bySide" :key="row.key">
                <td class="t-left t-name">{{ row.label }}</td>
                <td class="figure">{{ row.won }}-{{ row.lost }}<span v-if="row.push">-{{ row.push }}</span></td>
                <td class="figure">{{ pct(row.winRate) }}</td>
                <td class="figure t-muted">{{ pct(row.breakEven) }}</td>
                <td class="figure" :class="signClass(row.edge)">{{ pct(row.edge, true) }}</td>
                <td class="figure" :class="signClass(row.profit)">{{ money(row.profit) }}</td>
                <td class="figure" :class="signClass(row.roi)">{{ pct(row.roi, true) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="stats-section" v-if="teamRows.length">
        <h4>Teams that paid, and didn&apos;t</h4>
        <p class="section-note">Best and worst by net, over at least {{ MIN_TEAM_BETS }} settled bets.</p>
        <div class="table-scroll">
          <table class="stat-table">
            <thead>
              <tr>
                <th class="t-left">Team</th>
                <th>Record</th>
                <th>Win rate</th>
                <th>Wagered</th>
                <th>Net</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in teamRows" :key="row.key">
                <td class="t-left t-name">{{ row.label }}</td>
                <td class="figure">{{ row.won }}-{{ row.lost }}<span v-if="row.push">-{{ row.push }}</span></td>
                <td class="figure">{{ pct(row.winRate) }}</td>
                <td class="figure t-muted">${{ Math.round(row.wagered).toLocaleString() }}</td>
                <td class="figure" :class="signClass(row.profit)">{{ money(row.profit) }}</td>
                <td class="figure" :class="signClass(row.roi)">{{ pct(row.roi, true) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
    <div v-else class="no-stats">
      <p>No completed bets yet. Place some bets and wait for them to resolve to see your statistics!</p>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import { isSettled, summarize, summarizeBy, edgeOf } from '../utils/betAnalytics.js'

export default {
  name: 'AdvancedStats',
  props: {
    username: {
      type: String,
      required: false,
      default: null
    }
  },
  setup(props) {
    const userStore = useUserStore()
    const selectedSport = ref('all')

    // Calculate stats from user's bets
    const stats = computed(() => {
      const currentUser = userStore.currentUser.value
      if (!currentUser?.bets || currentUser.bets.length === 0) {
        return {
          winPercentageByType: {},
          winPercentageByTypeBySport: {},
          availableSports: []
        }
      }

      // Filter to completed bets
      const completedBets = currentUser.bets.filter(bet => 
        bet.status === 'won' || bet.status === 'lost' || bet.status === 'push'
      )

      // Group by sport
      const statsByBetTypeBySport = {}
      const userSports = new Set()

      completedBets.forEach(bet => {
        if (!bet.sport) return
        const sport = bet.sport
        userSports.add(sport)
        
        if (!statsByBetTypeBySport[sport]) {
          statsByBetTypeBySport[sport] = {
            moneyline: { won: 0, lost: 0, push: 0, total: 0 },
            spread: { won: 0, lost: 0, push: 0, total: 0 },
            total: { won: 0, lost: 0, push: 0, total: 0 }
          }
        }
        
        if (statsByBetTypeBySport[sport][bet.betType]) {
          statsByBetTypeBySport[sport][bet.betType][bet.status]++
          statsByBetTypeBySport[sport][bet.betType].total++
        }
      })

      // Calculate percentages for each sport
      const winPercentageByTypeBySport = {}
      for (const sport of userSports) {
        const statsByBetType = statsByBetTypeBySport[sport]
        winPercentageByTypeBySport[sport] = {}
        
        Object.keys(statsByBetType).forEach(betType => {
          const stats = statsByBetType[betType]
          const nonPushTotal = stats.total - stats.push
          if (nonPushTotal > 0) {
            winPercentageByTypeBySport[sport][betType] = {
              winRate: ((stats.won / nonPushTotal) * 100).toFixed(1),
              won: stats.won,
              lost: stats.lost,
              push: stats.push,
              total: stats.total
            }
          } else {
            winPercentageByTypeBySport[sport][betType] = {
              winRate: '0.0',
              won: 0,
              lost: 0,
              push: stats.push,
              total: stats.total
            }
          }
        })
      }

      // Calculate overall (all sports combined)
      const overallStatsByBetType = {
        moneyline: { won: 0, lost: 0, push: 0, total: 0 },
        spread: { won: 0, lost: 0, push: 0, total: 0 },
        total: { won: 0, lost: 0, push: 0, total: 0 }
      }

      completedBets.forEach(bet => {
        if (overallStatsByBetType[bet.betType]) {
          overallStatsByBetType[bet.betType][bet.status]++
          overallStatsByBetType[bet.betType].total++
        }
      })

      const winPercentageByType = {}
      Object.keys(overallStatsByBetType).forEach(betType => {
        const stats = overallStatsByBetType[betType]
        const nonPushTotal = stats.total - stats.push
        if (nonPushTotal > 0) {
          winPercentageByType[betType] = {
            winRate: ((stats.won / nonPushTotal) * 100).toFixed(1),
            won: stats.won,
            lost: stats.lost,
            push: stats.push,
            total: stats.total
          }
        } else {
          winPercentageByType[betType] = {
            winRate: '0.0',
            won: 0,
            lost: 0,
            push: stats.push,
            total: stats.total
          }
        }
      })

      winPercentageByTypeBySport.all = winPercentageByType

      // Calculate team statistics
      const teamStats = {}
      const allBets = currentUser.bets || []
      
      allBets.forEach(bet => {
        // Extract team name from selection or gameData
        let teamName = bet.selection
        if (bet.gameData) {
          // For moneyline bets, selection is the team name
          if (bet.betType === 'moneyline') {
            teamName = bet.selection
          } else if (bet.betType === 'spread' || bet.betType === 'total') {
            // For spread/total, try to extract team from selection
            // Selection might be like "Lakers -5.5" or "Over 220.5"
            if (bet.selection && !bet.selection.toLowerCase().includes('over') && !bet.selection.toLowerCase().includes('under')) {
              teamName = bet.selection.split(/[+-]/)[0].trim()
            }
          }
        }
        
        if (!teamName || teamName.toLowerCase().includes('over') || teamName.toLowerCase().includes('under')) {
          return // Skip totals bets for team stats
        }
        
        if (!teamStats[teamName]) {
          teamStats[teamName] = {
            name: teamName,
            count: 0,
            wins: 0,
            losses: 0,
            profit: 0
          }
        }
        
        teamStats[teamName].count++
        
        if (bet.status === 'won') {
          teamStats[teamName].wins++
          teamStats[teamName].profit += (bet.potentialWin || 0) - (bet.amount || 0)
        } else if (bet.status === 'lost') {
          teamStats[teamName].losses++
          teamStats[teamName].profit -= (bet.amount || 0)
        }
      })

      // Find most bet on team
      const mostBetTeam = Object.values(teamStats).length > 0
        ? Object.values(teamStats).reduce((max, team) => team.count > max.count ? team : max)
        : null

      // Find most profitable team
      const mostProfitableTeam = Object.values(teamStats).length > 0
        ? Object.values(teamStats).filter(t => t.profit > 0).reduce((max, team) => 
            team.profit > (max?.profit || 0) ? team : max, null)
        : null

      // Find team with most wins
      const mostWinsTeam = Object.values(teamStats).length > 0
        ? Object.values(teamStats).reduce((max, team) => team.wins > max.wins ? team : max)
        : null

      // Find team with most losses
      const mostLossesTeam = Object.values(teamStats).length > 0
        ? Object.values(teamStats).reduce((max, team) => team.losses > max.losses ? team : max)
        : null

      // Calculate sport statistics
      const sportStats = {}
      allBets.forEach(bet => {
        if (!bet.sport) return
        if (!sportStats[bet.sport]) {
          sportStats[bet.sport] = {
            name: bet.sport,
            count: 0,
            profit: 0
          }
        }
        sportStats[bet.sport].count++
        if (bet.status === 'won') {
          sportStats[bet.sport].profit += (bet.potentialWin || 0) - (bet.amount || 0)
        } else if (bet.status === 'lost') {
          sportStats[bet.sport].profit -= (bet.amount || 0)
        }
      })

      const favoriteSport = Object.values(sportStats).length > 0
        ? Object.values(sportStats).reduce((max, sport) => sport.count > max.count ? sport : max)
        : null

      const mostProfitableSport = Object.values(sportStats).length > 0
        ? Object.values(sportStats).filter(s => s.profit > 0).reduce((max, sport) => 
            sport.profit > (max?.profit || 0) ? sport : max, null)
        : null

      // Calculate bet type statistics
      const betTypeStats = {}
      allBets.forEach(bet => {
        if (!betTypeStats[bet.betType]) {
          betTypeStats[bet.betType] = { name: bet.betType, count: 0 }
        }
        betTypeStats[bet.betType].count++
      })

      const favoriteBetType = Object.values(betTypeStats).length > 0
        ? Object.values(betTypeStats).reduce((max, type) => type.count > max.count ? type : max)
        : null

      // Calculate total wagered and average bet
      const totalWagered = allBets.reduce((sum, bet) => sum + (bet.amount || 0), 0)
      const totalBets = allBets.length
      const averageBet = totalBets > 0 ? totalWagered / totalBets : 0

      // Calculate Over/Under preference
      const totalTypeBets = allBets.filter(b => b.betType === 'total')
      const overBets = totalTypeBets.filter(b => b.selection && b.selection.toLowerCase().includes('over'))
      const underBets = totalTypeBets.filter(b => b.selection && b.selection.toLowerCase().includes('under'))
      const totalOverUnderCount = overBets.length + underBets.length
      const overUnderPercent = totalOverUnderCount > 0 ? {
        over: ((overBets.length / totalOverUnderCount) * 100).toFixed(1),
        overCount: overBets.length,
        underCount: underBets.length
      } : null

      // Calculate Spread preference (favorite vs underdog)
      const allSpreadBets = allBets.filter(b => b.betType === 'spread')
      let favoriteBets = 0
      let underdogBets = 0
      
      allSpreadBets.forEach(bet => {
        if (bet.line) {
          // Parse the line value (e.g., "-5.5" or "+3.5")
          const lineValue = parseFloat(bet.line)
          if (!isNaN(lineValue)) {
            if (lineValue < 0) {
              // Negative spread = favorite
              favoriteBets++
            } else if (lineValue > 0) {
              // Positive spread = underdog
              underdogBets++
            }
            // If lineValue is 0, we skip it (shouldn't happen but just in case)
          }
        }
      })
      
      const totalSpreadPreferenceCount = favoriteBets + underdogBets
      const spreadPreference = totalSpreadPreferenceCount > 0 ? {
        favorite: ((favoriteBets / totalSpreadPreferenceCount) * 100).toFixed(1),
        favoriteCount: favoriteBets,
        underdogCount: underdogBets
      } : null

      // Calculate Spread coverage percentage
      const spreadBets = completedBets.filter(b => b.betType === 'spread')
      const coveredBets = spreadBets.filter(b => b.status === 'won')
      const notCoveredBets = spreadBets.filter(b => b.status === 'lost')
      const totalSpreadCount = coveredBets.length + notCoveredBets.length
      const spreadCoverPercent = totalSpreadCount > 0 ? {
        coverPercent: ((coveredBets.length / totalSpreadCount) * 100).toFixed(1),
        covered: coveredBets.length,
        notCovered: notCoveredBets.length
      } : null

      return {
        winPercentageByType,
        winPercentageByTypeBySport,
        availableSports: Array.from(userSports).sort(),
        teamStats,
        mostBetTeam,
        mostProfitableTeam,
        mostWinsTeam,
        mostLossesTeam,
        bettingPatterns: {
          favoriteSport,
          mostProfitableSport,
          favoriteBetType,
          totalWagered,
          totalBets,
          averageBet,
          overUnderPercent,
          spreadPreference,
          spreadCoverPercent
        }
      }
    })

    const formatBetType = (betType) => {
      const types = {
        moneyline: 'Moneyline',
        spread: 'Point Spread',
        total: 'Over/Under'
      }
      return types[betType] || betType
    }

    const formatSportName = (sport) => {
      const names = {
        'nfl': 'NFL',
        'nba': 'NBA',
        'ncaa-football': 'NCAA Football',
        'ncaa-basketball': 'NCAA Basketball'
      }
      return names[sport] || sport
    }

    // Money-aware view of the same bets - see utils/betAnalytics.js
    const settledBets = computed(() =>
      (userStore.currentUser.value?.bets || []).filter(isSettled))

    const filteredBets = computed(() => selectedSport.value === 'all'
      ? settledBets.value
      : settledBets.value.filter(b => b.sport === selectedSport.value))

    const overall = computed(() => summarize(filteredBets.value))

    const MARKET_ORDER = ['spread', 'moneyline', 'total']
    const byMarket = computed(() => {
      const grouped = summarizeBy(filteredBets.value, b => b.betType)
      return MARKET_ORDER
        .filter(key => grouped.has(key))
        .map(key => {
          const summary = grouped.get(key)
          return { key, label: formatBetType(key), ...summary, edge: edgeOf(summary) }
        })
    })

    const bySport = computed(() => {
      const grouped = summarizeBy(filteredBets.value, b => b.sport)
      return [...grouped.entries()]
        .map(([key, summary]) => ({ key, label: formatSportName(key), ...summary, edge: edgeOf(summary) }))
        .sort((a, b) => b.profit - a.profit)
    })

    // You bet favourites four times out of five - this is how that actually
    // goes, which the raw split never said.
    const sideOf = (bet) => {
      if (bet.betType === 'spread') {
        const n = parseFloat(bet.line)
        if (Number.isNaN(n)) return null
        return n < 0 ? 'Favorites' : 'Underdogs'
      }
      if (bet.betType === 'total') {
        if (bet.selection === 'Over') return 'Overs'
        if (bet.selection === 'Under') return 'Unders'
      }
      return null
    }

    const SIDE_ORDER = ['Favorites', 'Underdogs', 'Overs', 'Unders']
    const bySide = computed(() => {
      const grouped = summarizeBy(filteredBets.value, sideOf)
      return SIDE_ORDER
        .filter(key => grouped.has(key))
        .map(key => {
          const summary = grouped.get(key)
          return { key, label: key, ...summary, edge: edgeOf(summary) }
        })
    })

    // Teams, by money rather than by count. "Most bet on" and "most losses"
    // were both BYU and neither said whether that cost anything.
    const MIN_TEAM_BETS = 3
    const teamRows = computed(() => {
      const grouped = summarizeBy(
        filteredBets.value.filter(b => b.betType !== 'total'),
        b => b.selection
      )
      const rows = [...grouped.entries()]
        .filter(([, summary]) => summary.settled >= MIN_TEAM_BETS)
        .map(([name, summary]) => ({ key: name, label: name, ...summary, edge: edgeOf(summary) }))
        .sort((a, b) => b.profit - a.profit)
      if (rows.length <= 6) return rows
      return [...rows.slice(0, 3), ...rows.slice(-3)]
    })

    const pct = (v, signed = false) => {
      if (v === null || v === undefined || Number.isNaN(v)) return '—'
      const n = v * 100
      return (signed && n > 0 ? '+' : '') + n.toFixed(1) + '%'
    }

    const money = (v) => {
      if (v === null || v === undefined || Number.isNaN(v)) return '—'
      const n = Math.round(v)
      return (n < 0 ? '-$' : '+$') + Math.abs(n).toLocaleString()
    }

    const signClass = (v) =>
      v === null || v === undefined || Number.isNaN(v) || v === 0
        ? '' : (v > 0 ? 'positive' : 'negative')

    const currentWinPercentageByType = computed(() => {
      if (!stats.value?.winPercentageByTypeBySport) return stats.value?.winPercentageByType || {}
      const sportKey = selectedSport.value === 'all' ? 'all' : selectedSport.value
      return stats.value.winPercentageByTypeBySport[sportKey] || stats.value.winPercentageByType || {}
    })

    const onSportChange = () => {
      // Sport filter changed, computed property will update automatically
    }

    return {
      stats,
      selectedSport,
      currentWinPercentageByType,
      overall,
      byMarket,
      bySport,
      bySide,
      teamRows,
      MIN_TEAM_BETS,
      pct,
      money,
      signClass,
      formatBetType,
      formatSportName,
      onSportChange
    }
  }
}
</script>

<style scoped>
.advanced-stats {
  padding: 2rem;
}

.no-stats {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
}

.no-stats p {
  font-size: var(--text-base);
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-filter label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}

.sport-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.sport-select:hover {
  border-color: var(--color-text-subtle);
}

.sport-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.stats-section {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.stats-section h4 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 700;
}

.section-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fun-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.fun-stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.75rem;
}

.fun-stat-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.fun-stat-value.positive {
  color: var(--color-success);
}

.fun-stat-value.negative {
  color: var(--color-danger);
}

.fun-stat-detail {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 500;
}

@media (max-width: 768px) {

  .fun-stats-grid {
    grid-template-columns: 1fr;
  }

  .stats-section {
    padding: 1rem;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-filter {
    width: 100%;
  }

  .section-filter select {
    flex: 1;
  }
}

/* ── Flat treatment, matching the ledger band and board rows ──
   The panel nested white rounded cards inside grey rounded boxes, a different
   language from every other surface on this page, and spent a lot of height
   saying little. */

.stats-section {
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-bottom: var(--space-6);
}

.stats-section h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

/* One rule-divided strip, same shape as the page's ledger band */
.ledger-strip {
  display: flex;
  flex-wrap: wrap;
  border-top: 1.5px solid var(--color-text);
  border-bottom: 1px solid var(--color-border);
}

.ls-cell {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border-left: 1px solid var(--color-border);
}

.ls-cell:first-child { padding-left: 0; border-left: none; }

.ls-key {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.ls-val {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}

.ls-lead .ls-val { font-size: var(--text-2xl); }
.ls-val.positive { color: var(--color-success); }
.ls-val.negative { color: var(--color-danger); }

/* Markets read as a table because they are one - three rows of the same
   columns, which floating cards could not line up */

/* Records and patterns: hairline cells rather than boxes in boxes */
.fun-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0;
  /* container caps top and left, each cell caps its own right and bottom, so
     the block closes on all four sides however many cells wrap */
  border-top: 1px solid var(--color-border);
  border-left: 1px solid var(--color-border);
}

.fun-stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  border-radius: 0;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  box-shadow: none;
  transition: background 0.15s ease;
}

.fun-stat-card:hover {
  background: var(--color-surface-muted);
  border-color: var(--color-border);
  transform: none;
  box-shadow: none;
}

.fun-stat-label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.fun-stat-value {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}

.fun-stat-value.positive { color: var(--color-success); }
.fun-stat-value.negative { color: var(--color-danger); }

.fun-stat-detail {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.sport-select {
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.section-filter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

@media (max-width: 720px) {
  .ls-cell { flex: 1 1 40%; }
}

.section-note {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.section-note strong { color: var(--color-text); font-weight: 600; }

.table-scroll { overflow-x: auto; }

.stat-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.stat-table th {
  padding: 0 var(--space-3) var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text-subtle);
  text-align: right;
  white-space: nowrap;
}

.stat-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-base);
  text-align: right;
  white-space: nowrap;
}

.stat-table tbody tr:hover { background: var(--color-surface-muted); }

.stat-table .t-left { text-align: left; padding-left: 0; }
.stat-table .t-name { font-weight: 600; color: var(--color-text); }
.stat-table .t-muted { color: var(--color-text-muted); }
.stat-table td.positive { color: var(--color-success); font-weight: 600; }
.stat-table td.negative { color: var(--color-danger); font-weight: 600; }
</style>
