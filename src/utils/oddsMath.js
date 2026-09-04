// American odds math for the bet slip. Mirrors backend/utils/oddsMath.js -
// the server re-prices every parlay on submit, so this is for display only.

export const parseAmerican = (odds) => {
  if (odds === null || odds === undefined) return null
  if (typeof odds === 'number') return Number.isFinite(odds) ? odds : null
  const raw = String(odds).trim()
  if (/^even$/i.test(raw)) return 100
  const n = parseInt(raw.replace(/[^0-9+-]/g, ''), 10)
  return Number.isNaN(n) ? null : n
}

export const americanToDecimal = (odds) => {
  const n = parseAmerican(odds)
  if (n === null || n === 0) return null
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n)
}

export const decimalToAmerican = (decimal) => {
  if (!Number.isFinite(decimal) || decimal <= 1) return null
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : -Math.round(100 / (decimal - 1))
}

export const formatAmerican = (odds) => {
  const n = typeof odds === 'number' ? odds : parseAmerican(odds)
  if (n === null) return '-'
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * Display form of a bet's line: "-3.5", "+3.5", "o44.5", "u44.5".
 *
 * Was duplicated verbatim in BetSlip, ParlayCard, ParlayHistory and LiveBets.
 * BetCard had its own copy that ran the line through Math.abs(), so a
 * favourite's minus sign was dropped and "-3.5" and "+3.5" both displayed as
 * "3.5" — that copy is gone.
 *
 * @param {{line?: string|number, betType?: string, selection?: string}} bet
 * @returns {string} formatted line, or '' when there is none
 */
export const formatLine = (bet) => {
  if (!bet || bet.line === null || bet.line === undefined || bet.line === '') return ''
  if (bet.betType === 'total') return `${bet.selection === 'Over' ? 'o' : 'u'}${bet.line}`
  const n = parseFloat(bet.line)
  return Number.isNaN(n) ? String(bet.line) : (n > 0 ? `+${n}` : `${n}`)
}

// Pushed legs drop out of the price, matching how books settle them
export const combineLegs = (legs = []) => {
  const priced = legs.filter(leg => leg && leg.status !== 'push')
  if (!priced.length) return null
  let decimal = 1
  for (const leg of priced) {
    const d = americanToDecimal(leg.odds)
    if (d === null) return null
    decimal *= d
  }
  return decimal
}

export const calculatePayout = (legs, amount) => {
  const decimal = combineLegs(legs)
  if (decimal === null || !Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * decimal - amount)
}
