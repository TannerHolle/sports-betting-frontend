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
          <span class="ph-arrow" :class="{ open: isOpen(parlay._id) }"><svg class="icon-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
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
import { formatLine } from '../utils/oddsMath.js'
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
      displayLine: formatLine,
      tab, isAuthenticated, parlays, activeParlays, settledParlays, visible,
      isOpen, toggle, statusLabel, wonLegs, gameLabel,
      canCancel, cancel, cancelling, errors
    }
  }
}
</script>

<style scoped>
.parlay-history {
  display: flex;
  flex-direction: column;
}

.ph-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1.5px solid var(--color-text);
}

.ph-header h3 {
  margin: 0;
  font-size: var(--label-size);
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-text);
}

.ph-tabs {
  display: flex;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ph-tab {
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: none;
  border-left: 1px solid var(--color-border-strong);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.ph-tab:first-child { border-left: none; }
.ph-tab:hover { background: var(--color-surface-muted); color: var(--color-text); }

.ph-tab.active {
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.ph-empty,
.ph-error {
  padding: var(--space-5) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.ph-error { color: var(--color-danger); }

.ph-card {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--color-border);
}

.ph-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) 0;
  background: transparent;
  border: none;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.ph-head-left,
.ph-head-right {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.ph-legs {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}

.ph-odds,
.ph-amount {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-variant-numeric: tabular-nums;
}

.ph-odds { color: var(--color-success); }
.ph-amount { color: var(--color-text-muted); }

.ph-status {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ph-status.won { background: var(--color-success-soft); color: var(--color-success); }
.ph-status.lost { background: var(--color-danger-soft); color: var(--color-danger); }
.ph-status.push { background: var(--color-warning-soft); color: var(--color-warning); }

.ph-arrow { display: inline-flex; color: var(--color-text-subtle); }
.ph-arrow .icon-chevron { transform: rotate(-90deg); transition: transform 0.16s ease; }
.ph-arrow.open .icon-chevron { transform: rotate(0deg); }

.ph-progress {
  padding: 0 0 var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.ph-towin { color: var(--color-success); }

.ph-legs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 0 var(--space-3);
}

.ph-leg {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.ph-leg-dot {
  display: block;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--color-border-strong);
  flex: 0 0 auto;
}

.ph-leg-dot.won { background: var(--color-success); }
.ph-leg-dot.lost { background: var(--color-danger); }
.ph-leg-dot.push { background: var(--color-warning); }

.ph-leg-body {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ph-leg-pick {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
}

.ph-leg-line,
.ph-leg-odds {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.ph-leg-game {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.ph-leg-status {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  flex: 0 0 auto;
}

.ph-cancel {
  align-self: flex-start;
  margin-bottom: var(--space-3);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

.ph-cancel:hover { border-color: var(--color-danger); color: var(--color-danger); }
</style>
