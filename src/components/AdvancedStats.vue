<template>
  <div class="advanced-stats">
    <div v-if="stats && stats.availableSports && stats.availableSports.length > 0" class="stats-content">
      <!-- Win Percentage by Bet Type -->
      <div class="stats-section">
        <div class="section-header">
          <h4>Win Percentage by Bet Type</h4>
          <!-- Sport Filter inside the section -->
          <div class="section-filter" v-if="stats.availableSports && stats.availableSports.length > 0">
            <label for="sport-select">Filter by Sport:</label>
            <select id="sport-select" v-model="selectedSport" @change="onSportChange" class="sport-select">
              <option value="all">All Sports</option>
              <option v-for="sport in stats.availableSports" :key="sport" :value="sport">
                {{ formatSportName(sport) }}
              </option>
            </select>
          </div>
        </div>
        <div class="stats-grid">
          <div 
            v-for="(stat, betType) in currentWinPercentageByType" 
            :key="betType"
            class="stat-card"
          >
            <div class="stat-header">
              <span class="bet-type-label">{{ formatBetType(betType) }}</span>
            </div>
            <div class="stat-value" :class="{ 
              'positive': parseFloat(stat.winRate) > 50, 
              'negative': parseFloat(stat.winRate) < 50 
            }">
              {{ stat.winRate }}%
            </div>
            <div class="stat-details">
              <div class="stat-detail">
                <span class="label">Won:</span>
                <span class="value positive">{{ stat.won }}</span>
              </div>
              <div class="stat-detail">
                <span class="label">Lost:</span>
                <span class="value negative">{{ stat.lost }}</span>
              </div>
              <div v-if="stat.push > 0" class="stat-detail">
                <span class="label">Push:</span>
                <span class="value">{{ stat.push }}</span>
              </div>
              <div class="stat-detail">
                <span class="label">Total:</span>
                <span class="value">{{ stat.total }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Team Statistics -->
      <div class="stats-section" v-if="stats.teamStats && Object.keys(stats.teamStats).length > 0">
        <h4>🏈 Team Statistics</h4>
        <div class="fun-stats-grid">
          <div class="fun-stat-card" v-if="stats.mostBetTeam">
            <div class="fun-stat-label">Most Bet On</div>
            <div class="fun-stat-value">{{ stats.mostBetTeam.name }}</div>
            <div class="fun-stat-detail">{{ stats.mostBetTeam.count }} bets</div>
          </div>
          <div class="fun-stat-card" v-if="stats.mostProfitableTeam">
            <div class="fun-stat-label">Most Profitable</div>
            <div class="fun-stat-value positive">{{ stats.mostProfitableTeam.name }}</div>
            <div class="fun-stat-detail">+${{ stats.mostProfitableTeam.profit.toLocaleString() }}</div>
          </div>
          <div class="fun-stat-card" v-if="stats.mostWinsTeam">
            <div class="fun-stat-label">Most Wins</div>
            <div class="fun-stat-value positive">{{ stats.mostWinsTeam.name }}</div>
            <div class="fun-stat-detail">{{ stats.mostWinsTeam.wins }} wins</div>
          </div>
          <div class="fun-stat-card" v-if="stats.mostLossesTeam">
            <div class="fun-stat-label">Most Losses</div>
            <div class="fun-stat-value negative">{{ stats.mostLossesTeam.name }}</div>
            <div class="fun-stat-detail">{{ stats.mostLossesTeam.losses }} losses</div>
          </div>
        </div>
      </div>

      <!-- Betting Patterns -->
      <div class="stats-section" v-if="stats.bettingPatterns">
        <h4>📊 Betting Patterns</h4>
        <div class="fun-stats-grid">
          <div class="fun-stat-card" v-if="stats.bettingPatterns.favoriteSport">
            <div class="fun-stat-label">Favorite Sport</div>
            <div class="fun-stat-value">{{ formatSportName(stats.bettingPatterns.favoriteSport.name) }}</div>
            <div class="fun-stat-detail">{{ stats.bettingPatterns.favoriteSport.count }} bets</div>
          </div>
          <div class="fun-stat-card" v-if="stats.bettingPatterns.mostProfitableSport">
            <div class="fun-stat-label">Most Profitable Sport</div>
            <div class="fun-stat-value positive">{{ formatSportName(stats.bettingPatterns.mostProfitableSport.name) }}</div>
            <div class="fun-stat-detail">+${{ stats.bettingPatterns.mostProfitableSport.profit.toLocaleString() }}</div>
          </div>
          <div class="fun-stat-card" v-if="stats.bettingPatterns.favoriteBetType">
            <div class="fun-stat-label">Favorite Bet Type</div>
            <div class="fun-stat-value">{{ formatBetType(stats.bettingPatterns.favoriteBetType.name) }}</div>
            <div class="fun-stat-detail">{{ stats.bettingPatterns.favoriteBetType.count }} bets</div>
          </div>
          <div class="fun-stat-card" v-if="stats.bettingPatterns.overUnderPercent">
            <div class="fun-stat-label">Over/Under Preference</div>
            <div class="fun-stat-value">{{ stats.bettingPatterns.overUnderPercent.over }}%</div>
            <div class="fun-stat-detail">{{ stats.bettingPatterns.overUnderPercent.overCount }} Over / {{ stats.bettingPatterns.overUnderPercent.underCount }} Under</div>
          </div>
          <div class="fun-stat-card" v-if="stats.bettingPatterns.spreadPreference">
            <div class="fun-stat-label">Spread Preference</div>
            <div class="fun-stat-value">{{ stats.bettingPatterns.spreadPreference.favorite }}%</div>
            <div class="fun-stat-detail">{{ stats.bettingPatterns.spreadPreference.favoriteCount }} Favorite / {{ stats.bettingPatterns.spreadPreference.underdogCount }} Underdog</div>
          </div>
        </div>
      </div>

      <!-- Record Bets -->
      <div class="stats-section" v-if="stats.recordBets">
        <h4>🏆 Record Bets</h4>
        <div class="fun-stats-grid">
          <div class="fun-stat-card" v-if="stats.recordBets.largestBet">
            <div class="fun-stat-label">Largest Bet</div>
            <div class="fun-stat-value">${{ stats.recordBets.largestBet.amount.toLocaleString() }}</div>
            <div class="fun-stat-detail">{{ stats.recordBets.largestBet.team || 'N/A' }}</div>
          </div>
          <div class="fun-stat-card" v-if="stats.recordBets.biggestWin">
            <div class="fun-stat-label">Biggest Win</div>
            <div class="fun-stat-value positive">+${{ stats.recordBets.biggestWin.profit.toLocaleString() }}</div>
            <div class="fun-stat-detail">{{ stats.recordBets.biggestWin.team || 'N/A' }}</div>
          </div>
          <div class="fun-stat-card" v-if="stats.recordBets.biggestLoss">
            <div class="fun-stat-label">Biggest Loss</div>
            <div class="fun-stat-value negative">-${{ Math.abs(stats.recordBets.biggestLoss.profit).toLocaleString() }}</div>
            <div class="fun-stat-detail">{{ stats.recordBets.biggestLoss.team || 'N/A' }}</div>
          </div>
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

      // Find record bets
      const largestBet = allBets.length > 0
        ? allBets.reduce((max, bet) => (bet.amount || 0) > (max.amount || 0) ? bet : max)
        : null

      const biggestWin = completedBets.filter(b => b.status === 'won').length > 0
        ? completedBets.filter(b => b.status === 'won').reduce((max, bet) => {
            // potentialWin is already the profit amount (winnings on top of bet amount)
            const profit = bet.potentialWin || 0
            const maxProfit = max.potentialWin || 0
            return profit > maxProfit ? bet : max
          })
        : null

      const biggestLoss = completedBets.filter(b => b.status === 'lost').length > 0
        ? completedBets.filter(b => b.status === 'lost').reduce((max, bet) => 
            (bet.amount || 0) > (max.amount || 0) ? bet : max)
        : null

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
        },
        recordBets: {
          largestBet: largestBet ? {
            amount: largestBet.amount,
            team: largestBet.selection || 'N/A'
          } : null,
          biggestWin: biggestWin ? {
            profit: biggestWin.potentialWin || 0,
            team: biggestWin.selection || 'N/A'
          } : null,
          biggestLoss: biggestLoss ? {
            profit: -(biggestLoss.amount || 0),
            team: biggestLoss.selection || 'N/A'
          } : null
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

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  text-align: center;
  padding: 2rem;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: var(--radius-md);
  color: #991b1b;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.retry-btn:hover {
  background: #1d4ed8;
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
  background: white;
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

.section-description {
  margin: 0 0 1.5rem 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.subsection-description {
  margin: 0 0 1rem 0;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  font-style: italic;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  text-align: center;
}

.stat-header {
  margin-bottom: 1rem;
}

.bet-type-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--color-text);
}

.stat-value.positive {
  color: var(--color-success);
}

.stat-value.negative {
  color: var(--color-danger);
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: var(--text-sm);
}

.stat-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-detail .label {
  color: var(--color-text-muted);
}

.stat-detail .value {
  font-weight: 600;
  color: var(--color-text);
}

.stat-detail .value.positive {
  color: var(--color-success);
}

.stat-detail .value.negative {
  color: var(--color-danger);
}

.outcomes-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 1.5rem;
}

.outcome-section {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.outcome-section h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: var(--text-lg);
  font-weight: 600;
}

.outcome-section h5.centered-header {
  text-align: center;
}

.outcome-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.outcome-card {
  background: white;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.2s ease;
}

.outcome-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.outcome-card.over {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.outcome-card.under {
  border-color: var(--color-danger);
  background: #fef2f2;
}

.outcome-card.covered {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.outcome-card.covered-low {
  border-color: var(--color-warning);
  background: #fffbeb;
}

.outcome-card.covered-zero {
  border-color: var(--color-border);
  background: var(--color-surface-muted);
}

.outcome-card.push {
  border-color: #6366f1;
  background: #eef2ff;
}

.outcome-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.outcome-percentage {
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.outcome-card.over .outcome-percentage {
  color: var(--color-success);
}

.outcome-card.under .outcome-percentage {
  color: var(--color-danger);
}

.outcome-card.covered .outcome-percentage {
  color: var(--color-success);
}

.outcome-card.covered-low .outcome-percentage {
  color: var(--color-warning);
}

.outcome-card.covered-zero .outcome-percentage {
  color: var(--color-text-muted);
}

.outcome-count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.total-games {
  text-align: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}

.fun-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.fun-stat-card {
  background: white;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
}

.fun-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
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
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .fun-stats-grid {
    grid-template-columns: 1fr;
  }

  .outcome-stats {
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
</style>
