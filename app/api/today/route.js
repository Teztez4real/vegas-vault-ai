import { NextResponse } from 'next/server';

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(isoString) {
  if (!isoString) return 'TBD';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'
  }) + ' CT';
}

function assignSlots(games) {
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const dayBase = dayOfYear % 2 === 0 ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');
  let currentSlot = opposite(dayBase);
  let lastTime = null;
  return games.map((g, i) => {
    if (i === 0) { lastTime = g.rawTime; return { ...g, slot: currentSlot }; }
    if (g.rawTime !== lastTime) { currentSlot = opposite(currentSlot); lastTime = g.rawTime; }
    return { ...g, slot: currentSlot };
  });
}

// ── MLB STATS API (FREE) ──────────────────────────────────────────────────────

async function fetchMLBSchedule() {
  const today = todayStr();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,linescore`,
    { next: { revalidate: 600 } }
  );
  const data = await res.json();
  return data.dates?.[0]?.games || [];
}

async function fetchTeamRecord(teamId) {
  const season = new Date().getFullYear();
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json();
  for (const record of data.records || []) {
    for (const tr of record.teamRecords || []) {
      if (tr.team?.id === teamId) {
        const last10 = tr.records?.splitRecords?.find(r => r.type === 'lastTen');
        const last5 = tr.records?.splitRecords?.find(r => r.type === 'lastFive');
        const home = tr.records?.splitRecords?.find(r => r.type === 'home');
        const away = tr.records?.splitRecords?.find(r => r.type === 'away');
        return {
          overall: `${tr.wins}-${tr.losses}`,
          home: home ? `${home.wins}-${home.losses}` : 'N/A',
          away: away ? `${away.wins}-${away.losses}` : 'N/A',
          last5: last5 ? `${last5.wins}-${last5.losses}` : 'N/A',
          last10: last10 ? `${last10.wins}-${last10.losses}` : 'N/A',
          streak: tr.streak?.streakCode || 'N/A',
        };
      }
    }
  }
  return { overall: 'N/A', home: 'N/A', away: 'N/A', last5: 'N/A', last10: 'N/A', streak: 'N/A' };
}

async function fetchPitcherStats(pitcherId) {
  if (!pitcherId) return 'TBD';
  try {
    const season = new Date().getFullYear();
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&group=pitching&season=${season}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const s = data.stats?.[0]?.splits?.[0]?.stat || {};
    return [
      s.era ? `${s.era} ERA` : null,
      s.whip ? `${s.whip} WHIP` : null,
      s.strikeOuts ? `${s.strikeOuts} K` : null,
      s.inningsPitched ? `${s.inningsPitched} IP` : null,
      (s.wins !== undefined && s.losses !== undefined) ? `${s.wins}-${s.losses}` : null,
    ].filter(Boolean).join(', ') || 'Stats unavailable';
  } catch {
    return 'Stats unavailable';
  }
}

// ── THE ODDS API (PAID) ───────────────────────────────────────────────────────

async function fetchOddsData() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};

  try {
    // Current odds
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    const oddsData = await oddsRes.json();

    // Betting percentages (requires paid tier)
    let percentagesData = [];
    try {
      const pctRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${apiKey}&bookmakers=betonlineag`,
        { next: { revalidate: 300 } }
      );
      percentagesData = await pctRes.json();
    } catch {
      // percentages not available on free tier
    }

    const oddsMap = {};
    for (const game of (Array.isArray(oddsData) ? oddsData : [])) {
      const key = `${game.away_team}|${game.home_team}`;
      
      // Get DraftKings or first available bookmaker
      const bookmaker = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const spreads = bookmaker?.markets?.find(m => m.key === 'spreads');

      const homeML = h2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find(o => o.name === game.home_team);
      const awaySpread = spreads?.outcomes?.find(o => o.name === game.away_team);

      // Get opening line from first bookmaker timestamp
      const allBookmakers = game.bookmakers || [];
      const openingBook = allBookmakers[allBookmakers.length - 1];
      const openingH2h = openingBook?.markets?.find(m => m.key === 'h2h');
      const openingHomeML = openingH2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const openingAwayML = openingH2h?.outcomes?.find(o => o.name === game.away_team)?.price;

      const formatML = (price) => price ? (price > 0 ? `+${price}` : `${price}`) : 'N/A';

      // Calculate line movement
      let lineMovement = 'No significant movement';
      if (openingHomeML && homeML && openingHomeML !== homeML) {
        const diff = homeML - openingHomeML;
        const direction = diff > 0 ? 'moved toward home' : 'moved toward away';
        lineMovement = `Home opened ${formatML(openingHomeML)}, now ${formatML(homeML)} (${direction}, ${Math.abs(diff)} pts). Away opened ${formatML(openingAwayML)}, now ${formatML(awayML)}.`;
      } else if (homeML) {
        lineMovement = `Line stable. Home ${formatML(homeML)} / Away ${formatML(awayML)}.`;
      }

      oddsMap[key] = {
        homeML: formatML(homeML),
        awayML: formatML(awayML),
        runLine: homeSpread ? `Home ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${formatML(homeSpread.price)}) / Away ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point} (${formatML(awaySpread?.price)})` : 'N/A',
        openingHomeML: formatML(openingHomeML),
        openingAwayML: formatML(openingAwayML),
        lineMovement,
        // Betting percentages (available on paid tiers)
        betPercentage: 'Available with paid Odds API tier',
        moneyPercentage: 'Available with paid Odds API tier',
      };
    }
    return oddsMap;
  } catch (err) {
    console.error('Odds API error:', err.message);
    return {};
  }
}

// ── CBS SPORTS PREVIEW FETCHER ────────────────────────────────────────────────

async function fetchCBSSportsPreview(awayTeam, homeTeam) {
  try {
    // Search for CBS Sports preview article
    const query = encodeURIComponent(`${awayTeam} vs ${homeTeam} preview ${new Date().getFullYear()}`);
    const searchUrl = `https://www.cbssports.com/mlb/news/`;
    
    // We use a targeted search approach via CBS Sports game preview URL pattern
    const teamMap = {
      'New York Yankees': 'new-york-yankees',
      'Boston Red Sox': 'boston-red-sox',
      'Los Angeles Dodgers': 'los-angeles-dodgers',
      'San Diego Padres': 'san-diego-padres',
      'Chicago Cubs': 'chicago-cubs',
      'St. Louis Cardinals': 'st-louis-cardinals',
      'Houston Astros': 'houston-astros',
      'Seattle Mariners': 'seattle-mariners',
      'San Francisco Giants': 'san-francisco-giants',
      'Los Angeles Angels': 'los-angeles-angels',
      'Atlanta Braves': 'atlanta-braves',
      'New York Mets': 'new-york-mets',
      'Philadelphia Phillies': 'philadelphia-phillies',
      'Miami Marlins': 'miami-marlins',
      'Washington Nationals': 'washington-nationals',
      'Milwaukee Brewers': 'milwaukee-brewers',
      'Minnesota Twins': 'minnesota-twins',
      'Chicago White Sox': 'chicago-white-sox',
      'Detroit Tigers': 'detroit-tigers',
      'Cleveland Guardians': 'cleveland-guardians',
      'Kansas City Royals': 'kansas-city-royals',
      'Baltimore Orioles': 'baltimore-orioles',
      'Toronto Blue Jays': 'toronto-blue-jays',
      'Tampa Bay Rays': 'tampa-bay-rays',
      'Texas Rangers': 'texas-rangers',
      'Oakland Athletics': 'oakland-athletics',
      'Colorado Rockies': 'colorado-rockies',
      'Arizona Diamondbacks': 'arizona-diamondbacks',
      'Cincinnati Reds': 'cincinnati-reds',
      'Pittsburgh Pirates': 'pittsburgh-pirates',
    };

    const awaySlug = teamMap[awayTeam] || awayTeam.toLowerCase().replace(/\s+/g, '-');
    const homeSlug = teamMap[homeTeam] || homeTeam.toLowerCase().replace(/\s+/g, '-');

    // Try to fetch CBS Sports preview
    const previewUrl = `https://www.cbssports.com/mlb/gametracker/preview/MLB_${todayStr().replace(/-/g, '')}_${awaySlug.toUpperCase().replace(/-/g, '')}@${homeSlug.toUpperCase().replace(/-/g, '')}/`;
    
    const res = await fetch(previewUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VegasVaultAI/1.0)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
    }

    const html = await res.text();
    
    // Extract preview text from HTML
    const previewMatch = html.match(/<div[^>]*class="[^"]*preview[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (previewMatch) {
      const text = previewMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
      return text || `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
    }

    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  } catch {
    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  }
}

// ── TRELL RULE ALERTS ─────────────────────────────────────────────────────────

const STAR_PLAYERS = [
  'Shohei Ohtani', 'Aaron Judge', 'Mookie Betts', 'Freddie Freeman',
  'Fernando Tatis Jr.', 'Juan Soto', 'Yordan Alvarez', 'Ronald Acuna Jr.',
  'Mike Trout', 'Julio Rodriguez', 'Bobby Witt Jr.', 'Corey Seager',
  'Paul Goldschmidt', 'Nolan Arenado', 'Elly De La Cruz', 'Gunnar Henderson',
  'Rafael Devers', 'Jose Ramirez', 'Bryce Harper', 'Kyle Tucker',
];

async function fetchInjuryAlerts() {
  try {
    const res = await fetch(
      'https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=' + todayStr() + '&endDate=' + todayStr(),
      { next: { revalidate: 1800 } }
    );
    const data = await res.json();
    const alerts = [];
    for (const tx of data.transactions || []) {
      const playerName = tx.person?.fullName || '';
      if (STAR_PLAYERS.some(star => playerName.includes(star.split(' ')[1]))) {
        if (tx.typeDesc?.toLowerCase().includes('il') || tx.typeDesc?.toLowerCase().includes('injured')) {
          alerts.push({
            player: playerName,
            team: tx.toTeam?.name || tx.fromTeam?.name || 'Unknown',
            status: 'OUT',
            direction: `First game out → Bet ON ${tx.fromTeam?.name || 'their team'}`,
            raw: tx.typeDesc,
          });
        }
      }
    }
    return alerts;
  } catch {
    return [];
  }
}

// ── ASSEMBLE FULL GAME OBJECT ─────────────────────────────────────────────────

async function assembleGame(g, oddsMap) {
  const home = g.teams.home.team;
  const away = g.teams.away.team;
  const homePitcher = g.teams.home.probablePitcher;
  const awayPitcher = g.teams.away.probablePitcher;

  const oddsKey = `${away.name}|${home.name}`;
  const odds = oddsMap[oddsKey] || {};

  const [homeRecord, awayRecord, homePitcherStats, awayPitcherStats, cbsPreview] = await Promise.all([
    fetchTeamRecord(home.id),
    fetchTeamRecord(away.id),
    fetchPitcherStats(homePitcher?.id),
    fetchPitcherStats(awayPitcher?.id),
    fetchCBSSportsPreview(away.name, home.name),
  ]);

  return {
    id: g.gamePk,
    sport: 'MLB',
    rawTime: g.gameDate,
    time: formatTime(g.gameDate),
    date: todayStr(),
    away: away.name,
    home: home.name,
    awayRecord: awayRecord.overall,
    homeRecord: homeRecord.overall,
    awayAwayRecord: awayRecord.away,
    homeHomeRecord: homeRecord.home,
    awayLast5: awayRecord.last5,
    homeLast5: homeRecord.last5,
    awayLast10: awayRecord.last10,
    homeLast10: homeRecord.last10,
    awayStreak: awayRecord.streak,
    homeStreak: homeRecord.streak,
    awayML: odds.awayML || 'N/A',
    homeML: odds.homeML || 'N/A',
    runLine: odds.runLine || 'N/A',
    openingAwayML: odds.openingAwayML || 'N/A',
    openingHomeML: odds.openingHomeML || 'N/A',
    betPercentage: odds.betPercentage || 'N/A',
    moneyPercentage: odds.moneyPercentage || 'N/A',
    awayPitcher: awayPitcher?.fullName || 'TBD',
    homePitcher: homePitcher?.fullName || 'TBD',
    awayPitcherStats,
    homePitcherStats,
    awayBullpenERA: 'See team stats',
    homeBullpenERA: 'See team stats',
    awayOffense: `${awayRecord.overall} record, ${awayRecord.last10} last 10`,
    homeOffense: `${homeRecord.overall} record, ${homeRecord.last10} last 10`,
    h2hLast5: 'See MLB Stats',
    h2hAtHome: 'See MLB Stats',
    injuries: 'Check injury reports',
    lineMovement: odds.lineMovement || 'Odds API not connected',
    cbsPreview,
    seriesGame: g.seriesGameNumber || 1,
    seriesLength: g.gamesInSeries || 3,
    slot: 'PUBLIC',
  };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [scheduleGames, oddsMap, trellAlerts] = await Promise.all([
      fetchMLBSchedule(),
      fetchOddsData(),
      fetchInjuryAlerts(),
    ]);

    const games = await Promise.all(
      scheduleGames.map(g => assembleGame(g, oddsMap))
    );

    games.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const withSlots = assignSlots(games);

    return NextResponse.json({
      games: withSlots,
      trellAlerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
