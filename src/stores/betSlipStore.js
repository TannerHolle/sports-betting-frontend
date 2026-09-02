import { ref, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { combineLegs, decimalToAmerican, formatAmerican, calculatePayout } from '../utils/oddsMath.js'
import { useUserStore } from './userStore.js'

const STORAGE_KEY = 'betSlip'
const MIN_LEGS = 2
const MAX_LEGS = 10

const legs = ref([])
const stake = ref(0)
const isOpen = ref(false)

// Keep the slip across page changes and reloads - you build a parlay by
// wandering between games, and losing it on navigation is infuriating.
const restore = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.legs)) {
      legs.value = saved.legs
      stake.value = saved.stake || 0
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}
const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ legs: legs.value, stake: stake.value }))
  } catch { /* private mode - the slip just won't survive a reload */ }
}
restore()

const legKey = (leg) => `${leg.gameId}:${leg.betType}:${leg.selection}:${leg.line ?? ''}`

const hasGame = (gameId) => legs.value.some(l => l.gameId === gameId)
const hasLeg = (leg) => legs.value.some(l => legKey(l) === legKey(leg))

const addLeg = (leg) => {
  if (legs.value.length >= MAX_LEGS) {
    return { success: false, error: `A parlay can have at most ${MAX_LEGS} legs` }
  }
  if (hasLeg(leg)) {
    removeLeg(leg)
    return { success: true, removed: true }
  }
  // Books don't allow two picks from one game - they're correlated
  if (hasGame(leg.gameId)) {
    return { success: false, error: 'You already have a pick from this game in your slip' }
  }
  legs.value.push({ ...leg })
  isOpen.value = true
  persist()
  return { success: true }
}

const removeLeg = (leg) => {
  legs.value = legs.value.filter(l => legKey(l) !== legKey(leg))
  if (!legs.value.length) isOpen.value = false
  persist()
}

const clear = () => {
  legs.value = []
  stake.value = 0
  isOpen.value = false
  persist()
}

const setStake = (value) => {
  stake.value = Number(value) || 0
  persist()
}

const combinedDecimal = computed(() => combineLegs(legs.value))
const combinedOdds = computed(() => {
  const d = combinedDecimal.value
  return d === null ? '-' : formatAmerican(decimalToAmerican(d))
})
const potentialWin = computed(() => calculatePayout(legs.value, stake.value))
const canPlace = computed(() => legs.value.length >= MIN_LEGS && stake.value > 0)

const placeParlay = async () => {
  const userStore = useUserStore()
  const user = userStore.currentUser.value
  if (!user) return { success: false, error: 'You need to be logged in' }
  if (legs.value.length < MIN_LEGS) return { success: false, error: `A parlay needs at least ${MIN_LEGS} legs` }
  if (stake.value <= 0) return { success: false, error: 'Enter a bet amount' }
  if (stake.value > (user.balance || 0)) return { success: false, error: 'Insufficient balance' }

  try {
    const { data } = await axios.post(`${API_BASE_URL}/user/${user.username}/parlay`, {
      amount: stake.value,
      legs: legs.value.map(l => ({
        gameId: l.gameId, betType: l.betType, selection: l.selection,
        odds: l.odds, line: l.line, sport: l.sport, gameData: l.gameData
      }))
    })
    clear()
    await userStore.loadUserFromAPI(user.username)
    return { success: true, parlay: data.parlay }
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to place parlay' }
  }
}

export const useBetSlip = () => ({
  legs: computed(() => legs.value),
  stake: computed(() => stake.value),
  isOpen,
  legCount: computed(() => legs.value.length),
  combinedOdds,
  potentialWin,
  canPlace,
  minLegs: MIN_LEGS,
  maxLegs: MAX_LEGS,
  addLeg,
  removeLeg,
  clear,
  setStake,
  hasLeg,
  hasGame,
  placeParlay
})
