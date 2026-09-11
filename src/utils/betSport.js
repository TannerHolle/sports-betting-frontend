/**
 * Which sport a bet belongs to.
 *
 * `bet.sport` is set on everything placed through the app; the team-name
 * matching below is a fallback for older rows that predate it. The lists
 * overlap on purpose-free names (Ohio State, Michigan and Kansas field both
 * football and basketball teams), so the first list to match wins - basketball
 * before football. That only ever decides which scoreboard gets fetched for a
 * legacy row, and the stored sport takes precedence whenever it exists.
 *
 * Lived identically in BetHistory and FriendsBets; one copy was lost when the
 * active-bets tab was removed, which took the other component's lookups down
 * with it at runtime.
 */
  export const getSportFromBet = (bet) => {
    if (bet.sport) {
      return bet.sport
    }
    
    const homeTeam = bet.gameData?.homeTeam?.toLowerCase() || ''
    const awayTeam = bet.gameData?.awayTeam?.toLowerCase() || ''
    
    const nflTeams = ['commanders', 'chiefs', 'cowboys', 'giants', 'eagles', 'washington', 'kansas city', 'dallas', 'new york', 'philadelphia', 'patriots', 'bills', 'dolphins', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers', 'cardinals', 'rams', '49ers', 'seahawks', 'packers', 'bears', 'lions', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers']
    if (nflTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
      return 'nfl'
    }
    
    const nbaTeams = ['lakers', 'kings', 'clippers', 'trail blazers', 'cavaliers', 'pistons', '76ers', 'magic', 'bulls', 'hawks', 'timberwolves', 'nuggets', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', 'bucks', 'pacers', 'hornets', 'wizards', 'thunder', 'mavericks', 'rockets', 'grizzlies', 'pelicans', 'spurs', 'suns', 'jazz', 'blazers']
    if (nbaTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
      return 'nba'
    }
    
    const ncaaBasketballTeams = ['duke', 'kentucky', 'north carolina', 'kansas', 'villanova', 'gonzaga', 'michigan state', 'michigan', 'ohio state', 'indiana', 'purdue', 'wisconsin', 'maryland', 'illinois', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'rutgers', 'penn state']
    if (ncaaBasketballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
      return 'ncaa-basketball'
    }
    
    const ncaaFootballTeams = ['alabama', 'auburn', 'georgia', 'florida', 'tennessee', 'lsu', 'texas a&m', 'ole miss', 'mississippi state', 'arkansas', 'missouri', 'kentucky', 'vanderbilt', 'south carolina', 'ohio state', 'michigan', 'penn state', 'michigan state', 'wisconsin', 'iowa']
    if (ncaaFootballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
      return 'ncaa-football'
    }
    
    return 'nba'
  }
