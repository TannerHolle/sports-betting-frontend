<template>
  <div class="bet-resolver" v-if="isAuthenticated && allOutstandingBets.length > 0">
    <div class="resolver-header">
      <h3>Admin: Resolve All Outstanding Bets</h3>
      <p class="resolver-description">
        Manually resolve outstanding bets from all users. Use this to test bet resolution or handle edge cases.
      </p>
    </div>

    <div class="bets-to-resolve">
      <div 
        v-for="betWithUser in allOutstandingBets" 
        :key="`${betWithUser.user.username}-${betWithUser.bet._id}`"
        class="bet-to-resolve"
      >
        <div class="bet-info">
          <div class="bet-header">
            <h4>{{ betWithUser.bet.gameData?.gameName || 'Game Data Unavailable' }}</h4>
            <span class="bet-owner">Owner: {{ betWithUser.user.username }}</span>
          </div>
          <div class="bet-details">
            <span class="bet-type">{{ formatBetType(betWithUser.bet.betType) }}</span>
            <span class="bet-selection">{{ betWithUser.bet.selection }}</span>
            <span class="bet-amount">${{ betWithUser.bet.amount.toLocaleString() }}</span>
          </div>
        </div>
        
        <div class="resolution-controls">
          <button 
            @click="resolveBet(betWithUser.bet._id, betWithUser.user.username, 'won')"
            class="resolve-btn won"
          >
            Won
          </button>
          <button 
            @click="resolveBet(betWithUser.bet._id, betWithUser.user.username, 'push')"
            class="resolve-btn push"
          >
            Push
          </button>
          <button 
            @click="resolveBet(betWithUser.bet._id, betWithUser.user.username, 'lost')"
            class="resolve-btn lost"
          >
            Lost
          </button>
        </div>
      </div>
    </div>

    <div v-if="resolutionMessage" class="resolution-message" :class="resolutionMessage.type">
      {{ resolutionMessage.text }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'BetResolver',
  setup() {
    const userStore = useUserStore()
    const resolutionMessage = ref('')
    const allUsers = ref({})

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    // Fetch all users' data
    const fetchAllUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/users`)
        allUsers.value = response.data
      } catch (error) {
        console.error('Error fetching all users:', error)
      }
    }

    // Get all outstanding bets from all users
    const allOutstandingBets = computed(() => {
      const betsWithUsers = []
      
      Object.values(allUsers.value).forEach(user => {
        if (user.bets) {
          const outstandingBets = user.bets.filter(bet => bet.status === 'pending')
          outstandingBets.forEach(bet => {
            betsWithUsers.push({
              bet: bet,
              user: user
            })
          })
        }
      })
      
      return betsWithUsers
    })

    const formatBetType = (betType) => {
      switch (betType) {
        case 'spread': return 'Point Spread'
        case 'moneyline': return 'Moneyline'
        case 'total': return 'Total Points'
        default: return betType
      }
    }

    const resolveBet = async (betId, username, result) => {
      try {
        const resultData = {
          status: result,
          resolvedAt: new Date().toISOString()
        }

        console.log(resultData)
        console.log(username)
        console.log(betId)
        
        // Call the backend to resolve the bet for the specific user
        const response = await axios.put(`${API_BASE_URL}/user/${username}/bet/${betId}`, resultData)
        
        if (response.data) {
          // If the resolved user is the currently logged-in user, refresh their data
          if (currentUser.value?.username === username) {
            await userStore.loadUserFromAPI(username)
          }
          // Find the bet to show details
          const user = allUsers.value[username]
          const bet = user?.bets?.find(b => b.id === betId)
          
          if (bet) {
            if (result === 'won') {
              const totalWinnings = bet.amount + bet.potentialWin
              resolutionMessage.value = {
                type: 'success',
                text: `🎉 ${username}'s bet won! Earned $${bet.potentialWin.toLocaleString()} profit (total return: $${totalWinnings.toLocaleString()})!`
              }
            } else if (result === 'push') {
              resolutionMessage.value = {
                type: 'info',
                text: `⚖️ ${username}'s bet pushed. Bet amount of $${bet.amount.toLocaleString()} returned.`
              }
            } else {
              resolutionMessage.value = {
                type: 'error',
                text: `😞 ${username}'s bet lost. Lost $${bet.amount.toLocaleString()}.`
              }
            }
          }
          
          // Refresh the users data to get updated bet statuses
          await fetchAllUsers()
        }
      } catch (error) {
        console.error('Error resolving bet:', error)
        resolutionMessage.value = {
          type: 'error',
          text: 'Failed to resolve bet. Please try again.'
        }
      }
      
      // Clear message after 3 seconds
      setTimeout(() => {
        resolutionMessage.value = ''
      }, 3000)
    }

    // Fetch users when component mounts
    onMounted(() => {
      fetchAllUsers()
    })

    return {
      isAuthenticated,
      allOutstandingBets,
      resolutionMessage,
      formatBetType,
      resolveBet
    }
  }
}
</script>

<style scoped>
.bet-resolver {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  margin-bottom: 2rem;
}

.resolver-header h3 {
  margin: 0 0 0.5rem 0;
  color: var(--color-text);
  font-size: var(--text-2xl);
  font-weight: 700;
}

.resolver-description {
  margin: 0 0 2rem 0;
  color: var(--color-text-muted);
  font-size: var(--text-base);
  line-height: 1.5;
}

.bets-to-resolve {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bet-to-resolve {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
}

.bet-to-resolve:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.bet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.bet-info h4 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: 600;
}

.bet-owner {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
}

.bet-details {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.bet-type {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 500;
}

.bet-selection {
  font-weight: 600;
  color: var(--color-text);
}

.bet-amount {
  font-weight: 700;
  color: var(--color-success);
}

.resolution-controls {
  display: flex;
  gap: 0.75rem;
}

.resolve-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: var(--text-base);
}

.resolve-btn.won {
  background: var(--color-success);
  color: var(--color-text-inverse);
}

.resolve-btn.won:hover {
  background: var(--color-success);
  transform: translateY(-1px);
}

.resolve-btn.lost {
  background: var(--color-danger);
  color: var(--color-text-inverse);
}

.resolve-btn.lost:hover {
  background: var(--color-danger);
  transform: translateY(-1px);
}

.resolve-btn.push {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.resolve-btn.push:hover {
  background: var(--color-primary);
  transform: translateY(-1px);
}

.resolution-message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  text-align: center;
}

.resolution-message.success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border: 1px solid var(--color-success-soft);
}

.resolution-message.error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-soft);
}

.resolution-message.info {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
  border: 1px solid var(--color-primary-soft);
}

@media (max-width: 768px) {
  .bet-resolver {
    padding: 1.5rem;
  }
  
  .bet-to-resolve {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .bet-details {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .resolution-controls {
    justify-content: center;
  }
}
</style>
