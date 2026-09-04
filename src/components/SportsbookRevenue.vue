<template>
  <div class="sportsbook-revenue" v-if="isAuthenticated">
    <div class="revenue-header">
      <h3>Sportsbook Revenue</h3>
      <p class="revenue-description">
        Track how much the sportsbook has made across all users
      </p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading revenue data...</p>
    </div>

    <div v-else class="revenue-stats">
      <div class="stat-card primary">
        <div class="stat-content">
          <div class="stat-value" :class="{ positive: houseProfit > 0, negative: houseProfit < 0 }">
            ${{ houseProfit.toLocaleString() }}
          </div>
          <div class="stat-label">House Profit/Loss</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">${{ totalCollected.toLocaleString() }}</div>
          <div class="stat-label">Total Collected</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">${{ totalPaidOut.toLocaleString() }}</div>
          <div class="stat-label">Total Paid Out</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">{{ totalUsers }}</div>
          <div class="stat-label">Total Users</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">{{ totalBetsCount }}</div>
          <div class="stat-label">Total Bets</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">${{ averageBetSize.toLocaleString() }}</div>
          <div class="stat-label">Avg Bet Size</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">${{ totalWagered.toLocaleString() }}</div>
          <div class="stat-label">Total Wagered</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">${{ pendingBetsAmount.toLocaleString() }}</div>
          <div class="stat-label">Pending Bets</div>
        </div>
      </div>
    </div>

    <div class="revenue-breakdown">
      <h4>Revenue Breakdown</h4>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <span class="breakdown-label">Total collected from lost bets:</span>
          <span class="breakdown-value positive">+${{ totalCollected.toLocaleString() }}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Total Winnings Paid out:</span>
          <span class="breakdown-value negative">-${{ totalPaidOut.toLocaleString() }}</span>
        </div>
        <div class="breakdown-item total">
          <span class="breakdown-label">Net Profit:</span>
          <span class="breakdown-value" :class="{ positive: houseProfit > 0, negative: houseProfit < 0 }">
            ${{ houseProfit.toLocaleString() }}
          </span>
        </div>
      </div>
    </div>

    <div class="refresh-controls">
      <button @click="fetchRevenueData" :disabled="loading" class="refresh-btn">
        {{ loading ? 'Refreshing...' : '🔄 Refresh Data' }}
      </button>
      <p class="last-updated" v-if="lastUpdated">
        Last updated: {{ formatTime(lastUpdated) }}
      </p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'SportsbookRevenue',
  setup() {
    const userStore = useUserStore()
    const loading = ref(false)
    const allUsers = ref([])
    const lastUpdated = ref(null)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)

    const fetchRevenueData = async () => {
      loading.value = true
      try {
        const response = await axios.get(`${API_BASE_URL}/users`)
        // Handle both array and object responses
        if (Array.isArray(response.data)) {
          allUsers.value = response.data
        } else {
          // Convert object to array if needed
          allUsers.value = Object.values(response.data)
        }
        lastUpdated.value = new Date()
      } catch (error) {
        console.error('Error fetching revenue data:', error)
      } finally {
        loading.value = false
      }
    }

    // Calculate total money collected by house (from lost bets)
    const totalCollected = computed(() => {
      return allUsers.value.reduce((sum, user) => {
        return sum + (user.totalLost || 0)
      }, 0)
    })

    // Calculate total money paid out by house (winnings from won bets)
    const totalPaidOut = computed(() => {
      return allUsers.value.reduce((sum, user) => {
        return sum + (user.totalWon || 0)
      }, 0)
    })

    // House profit = money collected - money paid out
    const houseProfit = computed(() => {
      return totalCollected.value - totalPaidOut.value
    })

    // Total number of users
    const totalUsers = computed(() => {
      return allUsers.value.length
    })

    // Total wagered across all users
    const totalWagered = computed(() => {
      return allUsers.value.reduce((sum, user) => {
        return sum + (user.totalWagered || 0)
      }, 0)
    })

    // Total number of bets across all users
    const totalBetsCount = computed(() => {
      return allUsers.value.reduce((sum, user) => {
        return sum + (user.bets?.length || 0)
      }, 0)
    })

    // Average bet size
    const averageBetSize = computed(() => {
      if (totalBetsCount.value === 0) return 0
      return Math.round(totalWagered.value / totalBetsCount.value)
    })

    // Profit margin percentage (house profit / total wagered * 100)
    const profitMargin = computed(() => {
      if (totalWagered.value === 0) return 0
      return ((houseProfit.value / totalWagered.value) * 100).toFixed(1)
    })

    // Pending bets amount (potential liability)
    const pendingBetsAmount = computed(() => {
      return allUsers.value.reduce((sum, user) => {
        if (!user.bets) return sum
        const pendingBets = user.bets.filter(bet => bet.status === 'pending')
        return sum + pendingBets.reduce((betSum, bet) => betSum + (bet.amount || 0), 0)
      }, 0)
    })

    const formatTime = (date) => {
      if (!date) return ''
      return date.toLocaleTimeString()
    }

    onMounted(() => {
      fetchRevenueData()
    })

    return {
      isAuthenticated,
      loading,
      houseProfit,
      totalCollected,
      totalPaidOut,
      totalUsers,
      totalWagered,
      totalBetsCount,
      averageBetSize,
      profitMargin,
      pendingBetsAmount,
      lastUpdated,
      fetchRevenueData,
      formatTime
    }
  }
}
</script>

<style scoped>
.sportsbook-revenue {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  margin-bottom: 2rem;
}

.revenue-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--color-surface-muted);
}

.revenue-header h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
  font-size: var(--text-2xl);
  font-weight: 700;
}

.revenue-description {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

.loading-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
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

.revenue-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.stat-card {
  background: var(--color-surface-muted);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-card.primary {
background: var(--color-primary);
border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.stat-card.primary .stat-label,
.stat-card.primary .stat-value {
  color: var(--color-text-inverse);
}

.stat-icon {
  font-size: var(--text-3xl);
  line-height: 1;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}

.stat-value.positive {
  color: var(--color-success);
}

.stat-card.primary .stat-value.positive {
  color: var(--color-text-inverse);
}

.stat-value.negative {
  color: var(--color-danger);
}

.stat-card.primary .stat-value.negative {
  color: var(--color-danger-soft);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-card.primary .stat-label {
  color: rgba(255, 255, 255, 0.9);
}

.revenue-breakdown {
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.revenue-breakdown h4 {
  margin: 0 0 1rem 0;
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  font-weight: 600;
}

.breakdown-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.breakdown-item.total {
  border: 2px solid var(--color-border);
  font-weight: 700;
  padding: 1rem;
}

.breakdown-label {
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

.breakdown-item.total .breakdown-label {
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

.breakdown-value {
  font-weight: 700;
  font-size: var(--text-lg);
}

.breakdown-value.positive {
  color: var(--color-success);
}

.breakdown-value.negative {
  color: var(--color-danger);
}

.breakdown-item.total .breakdown-value {
  font-size: var(--text-xl);
}

.refresh-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.refresh-btn {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: var(--text-sm);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.last-updated {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

@media (max-width: 1024px) {
  .revenue-stats {
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    max-width: 100%;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: var(--text-2xl);
  }
}

@media (max-width: 768px) {
  .sportsbook-revenue {
    padding: 1.5rem;
  }

  .revenue-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    max-width: 100%;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: var(--text-2xl);
  }

  .refresh-controls {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .refresh-btn {
    width: 100%;
  }

  .last-updated {
    text-align: center;
  }
}
</style>

