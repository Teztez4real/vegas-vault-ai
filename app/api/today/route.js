import { NextResponse } from 'next/server';
import { assignNBASlots } from '@/lib/nbaModel';

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

function fmt(price) {
  return price ? (price > 0 ? `+${price}` : `${price}`) : 'N/A';
}

// ── MLB SLOT SYSTEM ───────────────────────────────────────────────────────────
// PUBLIC days: Monday (1), Wednesday (3), Friday (5)
// VEGAS days:  Tuesday (2), Thursday (4), Saturday (6), Sunday (0)
//
// Rules:
// 1. First game = opposite of day base
// 2. Same time slot = hold
// 3. Single games in different time slots with no matching = hold
// 4. Matching time slots (2+ games same time) = switch
// 5. After matching group, next different time slot = switch
// 6. Last game different time slot = switch
// 7. Last game same time slot = hold

function assignMLBSlots(games, adminPattern = null) {
  // Slots ONLY come from the admin pattern — no auto-assignment
  if (adminPattern && Array.isArray(adminPattern) && adminPattern.length > 0) {
    return games.map((g, i) => ({ ...g, slot: adminPattern[i] || null }));
  }
  // No pattern set — return games with no slot (unassigned)
  return games.map(g => ({ ...g, slot: null }));


}

async function fetchNFLGames(dateParam) {
  try {
    // Check if NFL season is active (September through February)
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 8) return []; // March-August = offseason, no games

    const oddsResult = await fetchOdds('americanfootball_nfl');
    const oddsMap = oddsResult.oddsMap || oddsResult;
    if (Object.keys(oddsMap).length === 0) return [];

    const games = Object.entries(oddsMap)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, odds], i) => {
        const [away, home] = key.split('|');
        // Only include games on the selected date
        const gameDate = odds.commenceTime?.split('T')[0];
        if (gameDate && gameDate !== dateParam) return null;
        const ABBR = {
          "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL",
          "Buffalo Bills":"BUF","Carolina Panthers":"CAR","Chicago Bears":"CHI",
          "Cincinnati Bengals":"CIN","Cleveland Browns":"CLE","Dallas Cowboys":"DAL",
          "Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB",
          "Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX",
          "Kansas City Chiefs":"KC","Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC",
          "Los Angeles Rams":"LAR","Miami Dolphins":"MIA","Minnesota Vikings":"MIN",
          "New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG",
          "New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT",
          "San Francisco 49ers":"SF","Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB",
          "Tennessee Titans":"TEN","Washington Commanders":"WSH",
        };
        return {
          id: 2000 + i, sport: 'NFL',
          rawTime: odds.commenceTime,
          time: formatTime(odds.commenceTime),
          date: gameDate || dateParam,
          away, home,
          awayCity: away.split(' ').slice(0,-1).join(' ').toUpperCase(),
          homeCity: home.split(' ').slice(0,-1).join(' ').toUpperCase(),
          awayAbbr: ABBR[away] || away.split(' ').pop().slice(0,3).toUpperCase(),
          homeAbbr: ABBR[home] || home.split(' ').pop().slice(0,3).toUpperCase(),
          awayRecord: 'See NFL standings', homeRecord: 'See NFL standings',
          awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
          awayLast5: 'N/A', homeLast5: 'N/A', awayLast10: 'N/A', homeLast10: 'N/A',
          awayStreak: 'N/A', homeStreak: 'N/A',
          awayML: odds.awayML || 'N/A', homeML: odds.homeML || 'N/A',
          openingAwayML: odds.openingAwayML || 'N/A',
          openingHomeML: odds.openingHomeML || 'N/A',
          spread: odds.spread || 'N/A',
          total: odds.total || 'N/A',
          lineMovement: odds.lineMovement || 'N/A',
          betPercentage: 'Available with paid tier',
          moneyPercentage: 'Available with paid tier',
          awayQB: 'Check depth chart', homeQB: 'Check depth chart',
          awayQBStats: 'N/A', homeQBStats: 'N/A',
          awayOffense: 'Check NFL stats', homeOffense: 'Check NFL stats',
          awayDefense: 'Check NFL stats', homeDefense: 'Check NFL stats',
          h2hLast5: nflH2HMap[key] || 'Check NFL H2H history',
          injuries: 'Check rotowire.com/football/nfl/injury-report.php',
          weather: 'Check game time weather',
          cbsPreview: 'Check CBS Sports for preview',
          gameStatus: 'Scheduled',
          week: 'N/A', gameType: 'Regular Season',
          slot: 'PUBLIC',
        };
      }).filter(Boolean);

    return games; // slots applied externally
  } catch (err) {
    console.error('NFL games error:', err.message);
    return [];
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    const dateParam = searchParams.get('date') || todayStr();
  const [scheduleGames, mlbOddsResult, nbaGamesRaw, nflGamesRaw] = await Promise.all([
      fetchMLBSchedule(dateParam),
      fetchOdds('baseball_mlb'),
      fetchNBAGames(dateParam),
      fetchNFLGames(dateParam),
    ]);
    const mlbOdds = mlbOddsResult.oddsMap || mlbOddsResult;
    const mlbBookmakerCount = mlbOddsResult.bookmakerCount || 0;

    const mlbGamesRaw = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGamesRaw.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));

    // Fetch MLB slot pattern from Supabase
    let mlbPattern = null;
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      );
      const { data } = await sb.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'mlb').maybeSingle();
      if (data?.pattern?.length) {
        mlbPattern = data.pattern;
        console.log(`MLB slot pattern for ${dateParam}:`, data.pattern.map(s=>s[0]).join(''));
      }
    } catch (e) {
      console.warn('MLB slot pattern fetch failed:', e.message);
    }

    const mlbGames = assignMLBSlots(mlbGamesRaw, mlbPattern);

    // Log slot assignments for verification
    console.log('SLOT ASSIGNMENTS:', mlbGames.map(g =>
      `${(g.slot||'?')[0]}:${g.away.split(' ').pop()}@${g.home.split(' ').pop()}(${g.time})`
    ).join(' | '));
    // Fetch NFL slot pattern and apply
    let nflPattern = null;
    try {
      const { createClient: cc2 } = require('@supabase/supabase-js');
      const sb2 = cc2(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: nd } = await sb2.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'nfl').maybeSingle();
      if (nd?.pattern?.length) nflPattern = nd.pattern;
    } catch {}
    const nflGames = assignNFLSlots(nflGamesRaw, nflPattern);

    // Fetch NBA slot pattern and apply
    let nbaPattern = null;
    try {
      const { createClient: cc3 } = require('@supabase/supabase-js');
      const sb3 = cc3(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: nd2 } = await sb3.from('slot_patterns').select('pattern').eq('date', dateParam).eq('sport', 'nba').maybeSingle();
      if (nd2?.pattern?.length) nbaPattern = nd2.pattern;
    } catch {}
    const nbaGames = nbaPattern ? nbaGamesRaw.map((g,i) => ({ ...g, slot: nbaPattern[i]||null })) : nbaGamesRaw.map(g => ({ ...g, slot: null }));

    const allGames = [...mlbGames, ...nbaGames, ...nflGames];

    // ── LIVE AI INSIGHTS from real line movement data ────────────────────────
    const insights = [];
    const allMLBGames = mlbGames;
    for (const g of allMLBGames) {
      const mov = g.lineMovement || '';
      if (!mov || mov === 'N/A' || mov === 'Odds API not connected' || mov === 'No significant movement') continue;
      const homeShort = g.home.split(' ').pop();
      const awayShort = g.away.split(' ').pop();
      const minAgo = Math.floor(Math.random() * 12) + 1; // simulated recency

      if (mov.toLowerCase().includes('sharp') || mov.includes('moved toward home') || mov.includes('moved toward away')) {
        const side = mov.includes('moved toward home') ? homeShort : awayShort;
        insights.push({ icon:'◉', text:`Sharp money detected on ${side} — ${mov.slice(0,80)}`, time:`${minAgo}m ago` });
      } else if (mov.includes('public') || mov.includes('Public')) {
        insights.push({ icon:'◈', text:`Public heavy on ${homeShort} — potential fade spot vs ${awayShort}`, time:`${minAgo}m ago` });
      } else if (mov.includes('moved')) {
        insights.push({ icon:'○', text:`Line movement: ${awayShort} @ ${homeShort} — ${mov.slice(0,70)}`, time:`${minAgo}m ago` });
      } else if (mov.includes('stable') || mov.includes('Stable')) {
        // skip stable lines — not interesting
        continue;
      }
      if (insights.length >= 5) break;
    }

    // Always have at least 2 insights
    if (insights.length === 0) {
      const sampleGame = allMLBGames[0];
      if (sampleGame) {
        insights.push({ icon:'◉', text:`Monitoring ${allMLBGames.length} games for sharp line movement today`, time:'live' });
        insights.push({ icon:'◈', text:`${allMLBGames.filter(g=>g.slot==='VEGAS').length} Vegas slot games flagged for trap potential`, time:'live' });
      } else {
        insights.push({ icon:'◉', text:'Scanning active lines for sharp money movement', time:'live' });
        insights.push({ icon:'◈', text:'Public betting patterns updating in real time', time:'live' });
      }
    }

    // ── LIVE ODDS FEED from real odds data ───────────────────────────────────
    const ABBR_MAP = {
      "Yankees":"NYY","Red Sox":"BOS","Dodgers":"LAD","Padres":"SD","Cubs":"CHC",
      "Cardinals":"STL","Rays":"TB","Mets":"NYM","Braves":"ATL","Phillies":"PHI",
      "Guardians":"CLE","Astros":"HOU","Twins":"MIN","Mariners":"SEA","Giants":"SF",
      "Rockies":"COL","Brewers":"MIL","Orioles":"BAL","Tigers":"DET","Royals":"KC",
      "White Sox":"CHW","Pirates":"PIT","Reds":"CIN","Athletics":"OAK","Angels":"LAA",
      "Rangers":"TEX","Blue Jays":"TOR","Nationals":"WSH","Diamondbacks":"ARI","Marlins":"MIA",
    };
    const oddsFeed = allMLBGames.slice(0,10).map(g => {
      const homeLast = g.home.split(' ').pop();
      const abbr = ABBR_MAP[homeLast] || homeLast.slice(0,3).toUpperCase();
      const ml = g.homeML || 'N/A';
      const num = parseInt(ml);
      return { team: abbr, line: '-1.5', odds: ml, up: !isNaN(num) && num < 0 };
    }).filter(o => o.odds !== 'N/A');

    // ── MARKET SCANNER from line movement data ────────────────────────────────
    const reverseLineGames = allMLBGames.filter(g => (g.lineMovement||'').includes('moved toward') && (g.lineMovement||'').includes('public')).length;
    const sharpGames = allMLBGames.filter(g => (g.lineMovement||'').toLowerCase().includes('sharp') || (g.lineMovement||'').includes('moved toward')).length;
    const publicHeavyGames = allMLBGames.filter(g => (g.lineMovement||'').toLowerCase().includes('public')).length;
    const trapGames = allMLBGames.filter(g => g.slot === 'VEGAS').length;

    const marketScanner = {
      reverseLineMovement: Math.max(reverseLineGames, 1),
      sharpMoneyDetected: Math.max(sharpGames, 1),
      publicHeavy: Math.max(publicHeavyGames, 2),
      vegasTrapAlert: Math.max(trapGames, 1),
    };

    return NextResponse.json({
      games: allGames,
      trellAlerts: [],
      bookmakerCount: mlbBookmakerCount,
      insights,
      oddsFeed: oddsFeed.length > 0 ? oddsFeed : null,
      marketScanner,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
