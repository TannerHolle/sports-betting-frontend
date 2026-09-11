import axios from 'axios'

class LiveScoreService {
  constructor() {
    // One entry per sport, not per game. The old per-game cache couldn't help
    // the callers that hurt: getLiveScores fans out over N games at once, so
    // all N missed together and each fell through to its own full scoreboard
    // fetch. Worse, a game outside ESPN's current window never got cached at
    // all, so it re-fetched the whole scoreboard on every poll, forever.
    this.sportCache = new Map() // sport -> { games: Map, timestamp }
    this.inFlight = new Map()   // sport -> Promise, so parallel callers share one request
    this.cacheTimeout = 10000   // 10s - live scores don't move faster than this
  }

  // Format date for ESPN API (YYYYMMDD)
  formatDateForAPI(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }

  // Scoreboard URL for a sport.
  //
  // Deliberately undated. ESPN's undated scoreboard returns the current window
  // - the current week for NFL and college football, the current slate for the
  // basketball feeds - and a game that is live is by definition inside it.
  // Pinning ?dates=<today> breaks exactly when you need it: on 2026-09-02 the
  // dated college football feed returned 0 games while the undated one returned
  // the 25 games of that week. Completed games in the window are harmless here
  // because callers filter on isLive.
  scoreboardUrl(sport) {
    switch ((sport || '').toLowerCase()) {
      case 'nfl':
        return 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      case 'ncaa-basketball':
        return 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
      case 'ncaa-football':
        return 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
      case 'nba':
      default:
        return 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
    }
  }

  // Turn one ESPN event into the shape the UI wants
  parseGame(game) {
    const competition = game.competitions?.[0]
    if (!competition) return null
    const competitors = competition.competitors || []
    const homeTeam = competitors.find(c => c.homeAway === 'home')
    const awayTeam = competitors.find(c => c.homeAway === 'away')
    if (!homeTeam || !awayTeam) return null
    const status = competition.status

    return {
      gameId: String(game.id),
      homeTeam: homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || 'Home',
      awayTeam: awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || 'Away',
      homeScore: homeTeam.score || '0',
      awayScore: awayTeam.score || '0',
      status: this.formatStatus(status),
      isLive: status?.type?.state === 'in',
      isCompleted: status?.type?.completed || false,
      period: status?.period ?? null,
      displayClock: status?.displayClock || null,
      gameStartTime: game.date || competition.date,
      gameStartTimeFormatted: status?.type?.shortDetail || null
    }
  }

  // A sport's whole scoreboard, keyed by game id.
  //
  // Every live-score path in the app funnels through here, so this is the one
  // place worth deduping: a fresh-enough copy is reused, and callers that
  // arrive while a request is already open share it instead of opening their
  // own. One sport costs one request per cacheTimeout no matter how many games
  // or components ask for it.
  async getScoresForSport(sport) {
    const key = (sport || 'nba').toLowerCase()

    const cached = this.sportCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.games

    const pending = this.inFlight.get(key)
    if (pending) return pending

    const request = axios.get(this.scoreboardUrl(key))
      .then(response => {
        const byId = new Map()
        for (const game of response.data.events || []) {
          const parsed = this.parseGame(game)
          if (parsed) byId.set(parsed.gameId, parsed)
        }
        this.sportCache.set(key, { games: byId, timestamp: Date.now() })
        return byId
      })
      .catch(error => {
        console.error(`Error fetching ${sport} scoreboard:`, error)
        // A stale slate beats no slate - scores only ever move forward
        return cached?.games || new Map()
      })
      .finally(() => {
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, request)
    return request
  }

  // Live data for a set of games, grouped so each sport costs one request
  async getScoresForBets(wagers = []) {
    const bySport = new Map()
    for (const w of wagers) {
      const sport = w.sport || 'nba'
      if (!bySport.has(sport)) bySport.set(sport, [])
      bySport.get(sport).push(String(w.gameId))
    }

    const results = new Map()
    await Promise.all([...bySport.entries()].map(async ([sport, ids]) => {
      const scores = await this.getScoresForSport(sport)
      for (const id of ids) {
        const found = scores.get(id)
        if (found) results.set(id, found)
      }
    }))
    return results
  }

  // Live score for one game. Shares the undated URL and the parsing with the
  // batched path above, so both agree on which games exist and what they say.
  // A game that isn't on the board costs nothing extra - the lookup misses the
  // sport's cached slate rather than triggering a fetch of its own.
  async getLiveScore(gameId, sport = 'nba') {
    const scores = await this.getScoresForSport(sport)
    return scores.get(String(gameId)) || null
  }

  // Format game status
  formatStatus(status) {
    if (!status) return 'Scheduled'
    
    if (status.type?.completed) {
      return 'Final'
    }
    
    if (status.type?.state === 'in') {
      const time = status.displayClock || '0:00'
      const period = status.period || 1
      
      // Check for halftime
      // For NFL, NCAA Football, NBA: halftime is at end of 2nd quarter (period 2, time 0:00 or 0.0)
      // For College Basketball: halftime is at end of 1st half (period 1, time 0:00 or 0.0)
      if ((time === '0:00' || time === '0.0') && period === 2) {
        return 'HALFTIME'
      }
      // For college basketball (2 halves), halftime is at end of 1st half
      if ((time === '0:00' || time === '0.0') && period === 1) {
        const sportType = status.type?.name?.toLowerCase() || ''
        if (sportType.includes('college') && sportType.includes('basketball')) {
          return 'HALFTIME'
        }
      }
      
      const periodText = this.getPeriodText(period, status.type?.name)
      return `${time} - ${periodText}`
    }
    
    return status.type?.shortDetail || 'Scheduled'
  }

  // Get period text based on sport
  getPeriodText(period, sportType) {
    if (sportType?.toLowerCase().includes('basketball')) {
      return `${period}${this.getOrdinalSuffix(period)} Quarter`
    } else if (sportType?.toLowerCase().includes('football')) {
      return `${period}${this.getOrdinalSuffix(period)} Quarter`
    }
    return `${period}${this.getOrdinalSuffix(period)}`
  }

  // Get ordinal suffix
  getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) return 'th'
    switch (num % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  // Get live scores for multiple games. One request for the sport, then N
  // lookups against it - this used to be N parallel getLiveScore calls, which
  // all missed the cache at once and became N full scoreboard fetches.
  async getLiveScores(gameIds, sport = 'nba') {
    const scores = await this.getScoresForSport(sport)

    const liveScores = new Map()
    for (const gameId of gameIds) {
      const found = scores.get(String(gameId))
      if (found) liveScores.set(gameId, found)
    }
    return liveScores
  }

  // Clear cache
  clearCache() {
    this.sportCache.clear()
  }
}

export default new LiveScoreService()
