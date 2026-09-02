import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

class OddsService {
  constructor() {
    this.cachedOdds = null
    this.lastFetchTime = null
    this.inFlight = null
    // The server only refreshes odds once a day, so a short client cache is plenty
    this.cacheTtlMs = 5 * 60 * 1000
  }

  // Get odds for a specific sport
  async getOddsForSport(sport) {
    try {
      const response = await axios.get(`${API_BASE_URL}/odds/${sport}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error)
      return []
    }
  }

  // Get all odds.
  //
  // Every game card calls this when it mounts, so a 30-game slate used to mean
  // 30 identical requests. Cache the result and share any request already in
  // flight so a full page costs one round trip.
  async getAllOdds({ force = false } = {}) {
    const isFresh = this.cachedOdds &&
      this.lastFetchTime &&
      (Date.now() - this.lastFetchTime) < this.cacheTtlMs

    if (!force && isFresh) return this.cachedOdds
    if (this.inFlight) return this.inFlight

    this.inFlight = axios.get(`${API_BASE_URL}/odds`)
      .then(response => {
        this.cachedOdds = response.data
        this.lastFetchTime = Date.now()
        return this.cachedOdds
      })
      .catch(error => {
        console.error('Error fetching all odds:', error)
        // Prefer a stale copy over nothing - odds change once a day
        return this.cachedOdds || {}
      })
      .finally(() => {
        this.inFlight = null
      })

    return this.inFlight
  }

  // Get last update time
  async getLastUpdateTime() {
    try {
      const response = await axios.get(`${API_BASE_URL}/odds/last-update`)
      return response.data.lastUpdated
    } catch (error) {
      console.error('Error fetching last update time:', error)
      return null
    }
  }

  // Convert odds data to betting format for game cards
  convertOddsToBettingFormat(oddsData, homeTeam, awayTeam) {
    if (!oddsData || !oddsData.odds) {
      return null
    }

    const betting = {}

    // Use the actual team names from the odds data, not the ESPN team names
    const actualHomeTeam = oddsData.homeTeam
    const actualAwayTeam = oddsData.awayTeam

    // Moneyline
    const homeMoneylineKey = `${actualHomeTeam}_moneyline`
    const awayMoneylineKey = `${actualAwayTeam}_moneyline`
    
    if (oddsData.odds[homeMoneylineKey] && oddsData.odds[awayMoneylineKey]) {
      betting.moneyline = {
        home: {
          close: {
            odds: oddsData.odds[homeMoneylineKey]
          }
        },
        away: {
          close: {
            odds: oddsData.odds[awayMoneylineKey]
          }
        }
      }
    }

    // Point Spread
    const homeSpreadKey = `${actualHomeTeam}_spread`
    const awaySpreadKey = `${actualAwayTeam}_spread`
    
    if (oddsData.odds[homeSpreadKey] && oddsData.odds[awaySpreadKey]) {
      betting.pointSpread = {
        home: {
          close: {
            line: oddsData.odds[homeSpreadKey].line,
            odds: oddsData.odds[homeSpreadKey].price
          }
        },
        away: {
          close: {
            line: oddsData.odds[awaySpreadKey].line,
            odds: oddsData.odds[awaySpreadKey].price
          }
        }
      }
    }

    // Total (Over/Under)
    if (oddsData.odds[`Over_total`] && oddsData.odds[`Under_total`]) {
      betting.total = {
        over: {
          close: {
            line: oddsData.odds[`Over_total`].line,
            odds: oddsData.odds[`Over_total`].price
          }
        },
        under: {
          close: {
            line: oddsData.odds[`Under_total`].line,
            odds: oddsData.odds[`Under_total`].price
          }
        }
      }
    }

    return Object.keys(betting).length > 0 ? betting : null
  }

  // Find odds for a specific game.
  //
  // ESPN and The Odds API name teams differently:
  //   ESPN shortDisplayName "N Illinois" / displayName "Northern Illinois Huskies"
  //   The Odds API                         "Northern Illinois Huskies"
  // displayName is the field that lines up, so pass the ESPN team objects and
  // match on that. homeTeam/awayTeam may also be plain strings.
  findGameOdds(allOdds, sport, homeTeam, awayTeam, gameDate = null) {
    const games = allOdds?.[sport]
    if (!Array.isArray(games) || games.length === 0) return null

    const homeNames = this.teamNameCandidates(homeTeam)
    const awayNames = this.teamNameCandidates(awayTeam)
    if (!homeNames.length || !awayNames.length) return null

    // 1. Exact match on normalized names. Every team in the feed normalizes
    //    uniquely, so this can't collide.
    const exact = games.filter(game =>
      homeNames.some(name => this.normalizeTeamName(name) === this.normalizeTeamName(game.homeTeam)) &&
      awayNames.some(name => this.normalizeTeamName(name) === this.normalizeTeamName(game.awayTeam))
    )
    if (exact.length) return this.pickClosest(exact, gameDate)

    // 2. Looser subset match for feeds that drop the nickname ("Albany" vs
    //    "Albany Great Danes"). Only the full names are used here - a bare
    //    location like "Miami" matches two different schools, and showing the
    //    wrong team's odds is worse than showing none.
    const loose = games.filter(game =>
      homeNames.slice(0, 2).some(name => this.namesCompatible(name, game.homeTeam)) &&
      awayNames.slice(0, 2).some(name => this.namesCompatible(name, game.awayTeam))
    )
    return loose.length ? this.pickClosest(loose, gameDate) : null
  }

  // Strip accents/punctuation so "San José State" and "San Jose State" agree
  normalizeTeamName(name) {
    return String(name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  teamTokens(name) {
    return new Set(this.normalizeTeamName(name).split(' ').filter(Boolean))
  }

  // True when one name's words are a subset of the other's
  namesCompatible(a, b) {
    const ta = this.teamTokens(a)
    const tb = this.teamTokens(b)
    if (!ta.size || !tb.size) return false
    const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
    for (const token of small) {
      if (!big.has(token)) return false
    }
    return true
  }

  // Names to try for an ESPN team, most specific first
  teamNameCandidates(team) {
    if (!team) return []
    if (typeof team === 'string') return [team]
    const candidates = [
      team.displayName,
      [team.location, team.name].filter(Boolean).join(' '),
      team.shortDisplayName,
      team.location
    ]
    return [...new Set(candidates.filter(Boolean))]
  }

  // Two teams can meet more than once in a feed (NBA back-to-backs, series).
  // When we know the ESPN start time, take the closest game to it.
  pickClosest(candidates, gameDate) {
    if (candidates.length === 1 || !gameDate) return candidates[0]
    const target = new Date(gameDate).getTime()
    if (Number.isNaN(target)) return candidates[0]
    return candidates.reduce((best, game) => {
      const delta = Math.abs(new Date(game.commenceTime).getTime() - target)
      return delta < best.delta ? { game, delta } : best
    }, { game: candidates[0], delta: Infinity }).game
  }

}

export default new OddsService()
