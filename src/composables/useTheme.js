import { ref, computed, watch } from 'vue'

/**
 * Light / dark / follow-the-system.
 *
 * `system` (the default) leaves the root element unstamped so the
 * prefers-color-scheme block in style.css governs; an explicit choice stamps
 * data-theme, which the stylesheet weights above the media query in both
 * directions.
 *
 * Module-level state so every caller shares one source of truth.
 */
const STORAGE_KEY = 'theme'
const MODES = ['system', 'light', 'dark']

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(stored) ? stored : 'system'
  } catch {
    // private mode, or site data blocked — fall back to following the system
    return 'system'
  }
}

const theme = ref(readStored())

function apply(mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

apply(theme.value)

watch(theme, (mode) => {
  apply(mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // preference just won't survive a reload; the page still renders correctly
  }
})

const LABELS = { system: 'System', light: 'Light', dark: 'Dark' }

export function useTheme() {
  const themeLabel = computed(() => LABELS[theme.value])

  const cycleTheme = () => {
    theme.value = MODES[(MODES.indexOf(theme.value) + 1) % MODES.length]
  }

  return { theme, themeLabel, cycleTheme, setTheme: (m) => { if (MODES.includes(m)) theme.value = m } }
}
