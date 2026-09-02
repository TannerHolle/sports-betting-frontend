<template>
  <div class="parlay-history" v-if="isAuthenticated && parlays.length">
    <div class="ph-header">
      <h3>Your Parlays</h3>
      <div class="ph-tabs">
        <button @click="tab = 'active'" :class="{ active: tab === 'active' }" class="ph-tab">
          Active ({{ activeParlays.length }})
        </button>
        <button @click="tab = 'settled'" :class="{ active: tab === 'settled' }" class="ph-tab">
          Settled ({{ settledParlays.length }})
        </button>
      </div>
    </div>

    <div v-if="!visible.length" class="ph-empty">
      No {{ tab }} parlays.
    </div>

    <div v-for="parlay in visible" :key="parlay._id" class="ph-card" :class="parlay.status">
      <button class="ph-card-head" @click="toggle(parlay._id)">
        <div class="ph-head-left">
          <span class="ph-status" :class="parlay.status">{{ statusLabel(parlay.status) }}</span>
          <span class="ph-legs">{{ parlay.legs.length }}-leg parlay</span>
          <span class="ph-odds">{{ parlay.odds }}</span>
        </div>
        <div class="ph-head-right">
          <span class="ph-amount">${{ parlay.amount.toLocaleString() }}</span>
          <span class="ph-arrow">{{ isOpen(parlay._id) ? '▾' : '▸' }}</span>
        </div>
      </button>

      <div class="ph-progress" v-if="parlay.status === 'pending'">
        {{ wonLegs(parlay) }} of {{ parlay.legs.length }} legs hit
        <span class="ph-towin">· to win ${{ parlay.potentialWin.toLocaleString() }}</span>
      </div>
      <div class="ph-progress" v-else-if="parlay.status === 'won'">
        Won ${{ parlay.potentialWin.toLocaleString() }}
      </div>
      <div class="ph-progress" v-else-if="parlay.status === 'push'">
        Refunded ${{ parlay.amount.toLocaleString() }}
      </div>

      <div v-show="isOpen(parlay._id)" class="ph-legs-list">
        <div v-for="(leg, i) in parlay.legs" :key="i" class="ph-leg" :class="leg.status">
          <span class="ph-leg-dot" :class="leg.status"></span>
          <div class="ph-leg-body">
            <div class="ph-leg-pick">
              {{ leg.selection }}
              <span v-if="leg.line" class="ph-leg-line">{{ displayLine(leg) }}</span>
              <span class="ph-leg-odds">{{ leg.odds }}</span>
            </div>
            <div class="ph-leg-game">{{ gameLabel(leg) }}</div>
          </div>
          <span class="ph-leg-status" :class="leg.status">{{ statusLabel(leg.status) }}</span>
        </div>

        <button
          v-if="parlay.status === 'pending' && canCancel(parlay)"
          @click="cancel(parlay)"
          :disabled="cancelling === parlay._id"
          class="ph-cancel"
        >
          {{ cancelling === parlay._id ? 'Cancelling…' : 'Cancel parlay' }}
        </button>
        <p v-if="errors[parlay._id]" class="ph-error">{{ errors[parlay._id] }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, reactive } from 'vue'
import axios from 'axios'
import { useUserStore } from '../stores/userStore.js'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'ParlayHistory',
  setup() {
    const userStore = useUserStore()
    const tab = ref('active')
    const open = ref(new Set())
    const cancelling = ref(null)
    const errors = reactive({})

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)
    const parlays = computed(() => currentUser.value?.parlays || [])

    const byNewest = (list) => [...list].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    const activeParlays = computed(() => byNewest(parlays.value.filter(p => p.status === 'pending')))
    const settledParlays = computed(() => byNewest(parlays.value.filter(p => p.status !== 'pending')))
    const visible = computed(() => (tab.value === 'active' ? activeParlays.value : settledParlays.value))

    const isOpen = (id) => open.value.has(id)
    const toggle = (id) => {
      const next = new Set(open.value)
      next.has(id) ? next.delete(id) : next.add(id)
      open.value = next
    }

    const statusLabel = (s) => ({ pending: 'Open', won: 'Won', lost: 'Lost', push: 'Push' }[s] || s)
    const wonLegs = (p) => p.legs.filter(l => l.status === 'won').length

    const gameLabel = (leg) =>
      leg.gameData?.gameName ||
      (leg.gameData?.awayTeam && leg.gameData?.homeTeam
        ? `${leg.gameData.awayTeam} @ ${leg.gameData.homeTeam}`
        : leg.sport || '')

    const displayLine = (leg) => {
      if (!leg.line) return ''
      if (leg.betType === 'total') return `${leg.selection === 'Over' ? 'o' : 'u'}${leg.line}`
      const n = parseFloat(leg.line)
      return Number.isNaN(n) ? leg.line : (n > 0 ? `+${n}` : `${n}`)
    }

    // Mirrors the server rule: cancellable only while every game is unstarted
    const canCancel = (parlay) => {
      const now = Date.now()
      return parlay.legs.every(leg => {
        const t = leg.gameData?.gameStartTime
        if (!t) return true
        const d = new Date(t).getTime()
        return Number.isNaN(d) || d > now
      })
    }

    const cancel = async (parlay) => {
      cancelling.value = parlay._id
      errors[parlay._id] = ''
      try {
        await axios.delete(`${API_BASE_URL}/user/${currentUser.value.username}/parlay/${parlay._id}`)
        await userStore.loadUserFromAPI(currentUser.value.username)
      } catch (error) {
        errors[parlay._id] = error.response?.data?.error || 'Failed to cancel parlay'
      } finally {
        cancelling.value = null
      }
    }

    return {
      tab, isAuthenticated, parlays, activeParlays, settledParlays, visible,
      isOpen, toggle, statusLabel, wonLegs, gameLabel, displayLine,
      canCancel, cancel, cancelling, errors
    }
  }
}
</script>

<style scoped>
.parlay-history {
  /* Mirrors .bet-history so the two sections read as one family */
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 2rem;
  margin-bottom: 2rem;
}

.ph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}
.ph-header h3 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }

.ph-tabs { display: flex; gap: 0.5rem; }

/* Same shape as .tab-btn in BetHistory */
.ph-tab {
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--color-border);
  background: white;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.3s ease;
}

.ph-tab.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.ph-empty { color: var(--color-text-muted); padding: 1rem 0; }

.ph-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  overflow: hidden;
}
.ph-card.won { border-left: 3px solid var(--color-success); }
.ph-card.lost { border-left: 3px solid var(--color-danger); }
.ph-card.push { border-left: 3px solid var(--color-warning); }
.ph-card.pending { border-left: 3px solid var(--color-primary); }

.ph-card-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.ph-head-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ph-head-right { display: flex; align-items: center; gap: 10px; }

.ph-status {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
}
.ph-status.pending { background: var(--color-primary-soft); color: var(--color-primary); }
.ph-status.won { background: var(--color-success-soft); color: var(--color-success); }
.ph-status.lost { background: #fef2f2; color: var(--color-danger); }
.ph-status.push { background: #fffbeb; color: #92400e; }

.ph-legs { font-weight: 600; color: var(--color-text); font-size: var(--text-sm); }
.ph-odds { font-weight: 700; color: var(--color-primary); font-variant-numeric: tabular-nums; }
.ph-amount { font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }

.ph-arrow { color: var(--color-text-subtle); }

.ph-progress {
  padding: 0 14px 12px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.ph-towin { color: var(--color-success); }

.ph-legs-list { padding: 0 14px 14px; border-top: 1px solid var(--color-border); }

.ph-leg { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
.ph-leg + .ph-leg { border-top: 1px dashed var(--color-border); }

.ph-leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ph-leg-dot.pending { background: var(--color-text-subtle); }
.ph-leg-dot.won { background: var(--color-success); }
.ph-leg-dot.lost { background: var(--color-danger); }
.ph-leg-dot.push { background: var(--color-warning); }

.ph-leg-body { flex: 1; min-width: 0; }
.ph-leg-pick { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.ph-leg-line { color: var(--color-text-muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.ph-leg-odds { color: var(--color-primary); margin-left: 6px; font-variant-numeric: tabular-nums; }
.ph-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ph-leg-status { font-size: var(--text-xs); font-weight: 600; }
.ph-leg-status.won { color: var(--color-success); }
.ph-leg-status.lost { color: var(--color-danger); }
.ph-leg-status.push { color: #92400e; }
.ph-leg-status.pending { color: var(--color-text-subtle); }

.ph-cancel {
  margin-top: 12px;
  padding: 8px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--text-xs);
  font-family: inherit;
  cursor: pointer;
}
.ph-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
.ph-error { margin-top: 8px; font-size: var(--text-xs); color: var(--color-danger); }

@media (max-width: 768px) {
  .parlay-history { padding: 1rem; }
  .ph-header { flex-direction: column; align-items: flex-start; }
}
</style>
