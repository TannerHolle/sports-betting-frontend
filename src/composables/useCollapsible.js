import { ref } from 'vue'

/**
 * A collapsed/expanded flag that survives a reload.
 *
 * Shared so the panels that use it can't drift apart, and so the storage
 * guard lives in one place - localStorage throws outright in some contexts
 * (private windows, blocked site data), and a panel that refuses to render
 * because it couldn't read a preference would be a bad trade.
 *
 * @param {string} key       localStorage key, unique per panel
 * @param {boolean} initial  collapsed by default?
 */
export function useCollapsible(key, initial = false) {
  const read = () => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : stored === '1'
    } catch {
      return initial
    }
  }

  const collapsed = ref(read())

  const toggle = () => {
    collapsed.value = !collapsed.value
    try {
      localStorage.setItem(key, collapsed.value ? '1' : '0')
    } catch {
      // the preference just won't survive a reload
    }
  }

  return { collapsed, toggle }
}
