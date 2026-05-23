import { NextResponse } from 'next/server';
import { assignNBASlots, NBA_MOCK_GAMES } from '@/lib/nbaModel';

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

function assignMLBSlots(games) {
  const dayOfWeek = new Date().getDay();
  const publicDays = [1, 3, 5];
  const dayBase = publicDays.includes(dayOfWeek) ? 'PUBLIC' : 'VEGAS';
  const opposite = (s) => (s === 'PUBLIC' ? 'VEGAS' : 'PUBLIC');

  if (games.length === 0) return games;

  // Group games by time slot
  const timeGroups = [];
  let currentGroup = [games[0]];
  for (let i = 1; i < games.length; i++) {
    if (games[i].rawTime === games[i - 1].rawTime) {
      currentGroup.push(games[i]);
    } else {
      timeGroups.push(currentGroup);
      currentGroup = [games[i]];
    }
  }
  timeGroups.push(currentGroup);

  let currentSlot = opposite(dayBase);
  const result = [];
  let justHadMatchingGroup = false;

  for (let g = 0; g < timeGroups.length; g++) {
    const group = timeGroups[g];
    const isFirstGroup = g === 0;
    const isLastGroup = g === timeGroups.length - 1;
    const isMatchingGroup = group.length > 1;
    const isSingleGame = group.length === 1;

    if (isFirstGroup) {
      currentSlot = opposite(dayBase);
      justHadMatchingGroup = isMatchingGroup;
    } else if (isMatchingGroup) {
      currentSlot = opposite(currentSlot);
      justHadMatchingGroup = true;
    } else if (isSingleGame) {
      if (justHadMatchingGroup) {
        currentSlot = opposite(currentSlot);
        justHadMatchingGroup = false;
      } else if (isLastGroup) {
        currentSlot = opposite(currentSlot);
      }
    }

    for (const game of group) {
      result.push({ ...game, slot: currentSlot });
    }
  }

  return result;
}

// ── CBS SPORTS PREVIEW ────────────────────────────────────────────────────────

async function fetchCBSSportsPreview(awayTeam, homeTeam, sport = 'mlb') {
  try {
    const res = await fetch(`https://www.cbssports.com/${sport}/news/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
    const html = await res.text();
    const match = html.match(/class="[^"]*article[^"]*"[^>]*>([\s\S]{100,800}?)<\/[^>]+>/i);
    if (match) {
      return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    }
    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  } catch {
    return `CBS Sports preview not available for ${awayTeam} @ ${homeTeam}`;
  }
}

// ── ESPN H2H ──────────────────────────────────────────────────────────────────

async function fetchESPNH2H(awayTeam, homeTeam, sport = 'mlb') {
  try {
    const query = encodeURIComponent(`${awayTeam} vs ${homeTeam} head to head ${sport}`);
    const res = await fetch(`https://www.espn.com/${sport}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return `ESPN H2H not available for ${awayTeam} vs ${homeTeam}`;
    const html = await res.text();
    // Look for any mention of both teams near each other
    const awayShort = awayTeam.split(' ').pop();
    const homeShort = homeTeam.split(' ').pop();
    const pattern = new RegExp(`(${awayShort}[^<]{0,200}${homeShort}|${homeShort}[^<]{0,200}${awayShort})`, 'i');
    const match = html.match(pattern);
    if (match) {
      return `ESPN: ${match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}`;
    }
    return `ESPN H2H: Cross-reference ESPN.com for ${awayTeam} vs ${homeTeam} series history`;
  } catch {
    return `ESPN H2H: Cross-reference ESPN.com for ${awayTeam} vs ${homeTeam} series history`;
  }
}

// ── COVERS H2H ────────────────────────────────────────────────────────────────

async function fetchCoversH2H(awayTeam, homeTeam, sport = 'mlb') {
  try {
    const sportPath = sport === 'nba' ? 'nba' : 'mlb';
    const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-');
    const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-');
    const res = await fetch(`https://www.covers.com/${sportPath}/matchup/${awaySlug}-vs-${homeSlug}-odds`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return `Covers.com H2H: Cross-reference covers.com for ${awayTeam} vs ${homeTeam} ATS history`;
    const html = await res.text();
    const match = html.match(/(?:head.to.head|h2h|series|all.time)[^<]{0,600}/i);
    if (match) {
      return `Covers.com: ${match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)}`;
    }
    return `Covers.com H2H: Cross-reference covers.com for ${awayTeam} vs ${homeTeam} ATS and SU series history`;
  } catch {
    return `Covers.com H2H: Cross-reference covers.com for ${awayTeam} vs ${homeTeam} ATS and SU series history`;
  }
}

// ── ROTOWIRE INJURIES ─────────────────────────────────────────────────────────

async function fetchRotoWireInjuries(awayTeam, homeTeam, sport = 'mlb') {
  try {
    const sportPath = sport === 'nba' ? 'basketball/nba' : 'baseball/mlb';
    const res = await fetch(`https://www.rotowire.com/${sportPath}/injury-report.php`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return `RotoWire injuries: Cross-reference rotowire.com for ${awayTeam} and ${homeTeam} injury report`;
    const html = await res.text();
    const awayShort = awayTeam.split(' ').pop();
    const homeShort = homeTeam.split(' ').pop();
    // Extract injury rows containing either team name
    const rows = [];
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if ((row.includes(awayShort) || row.includes(homeShort)) && row.length > 10 && row.length < 300) {
        rows.push(row.slice(0, 150));
      }
    }
    if (rows.length > 0) {
      return `RotoWire: ${rows.slice(0, 6).join(' | ')}`;
    }
    return `RotoWire: No injuries listed for ${awayTeam} or ${homeTeam} — check rotowire.com/baseball/mlb/injury-report.php`;
  } catch {
    return `RotoWire injuries: Cross-reference rotowire.com for ${awayTeam} and ${homeTeam} injury report`;
  }
}

// ── THE ODDS API ──────────────────────────────────────────────────────────────

async function fetchOdds(sportKey) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    if (!Array.isArray(data)) return {};
    const oddsMap = {};
    for (const game of data) {
      const key = `${game.away_team}|${game.home_team}`;
      const bookmaker = game.bookmakers?.find(b => b.key === 'draftkings') || game.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const spreads = bookmaker?.markets?.find(m => m.key === 'spreads');
      const totals = bookmaker?.markets?.find(m => m.key === 'totals');
      const homeML = h2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const awayML = h2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      const homeSpread = spreads?.outcomes?.find(o => o.name === game.home_team);
      const awaySpread = spreads?.outcomes?.find(o => o.name === game.away_team);
      const total = totals?.outcomes?.[0]?.point;
      const openBook = game.bookmakers?.[game.bookmakers.length - 1];
      const openH2h = openBook?.markets?.find(m => m.key === 'h2h');
      const openHomeML = openH2h?.outcomes?.find(o => o.name === game.home_team)?.price;
      const openAwayML = openH2h?.outcomes?.find(o => o.name === game.away_team)?.price;
      let lineMovement = 'No significant movement';
      if (openHomeML && homeML && openHomeML !== homeML) {
        const diff = homeML - openHomeML;
        lineMovement = `Home opened ${fmt(openHomeML)}, now ${fmt(homeML)} (${diff > 0 ? 'moved toward home' : 'moved toward away'}, ${Math.abs(diff)} pts).`;
      } else if (homeML) {
        lineMovement = `Line stable. Home ${fmt(homeML)} / Away ${fmt(awayML)}.`;
      }
      oddsMap[key] = {
        homeML: fmt(homeML), awayML: fmt(awayML),
        openingHomeML: fmt(openHomeML), openingAwayML: fmt(openAwayML),
        spread: homeSpread ? `${game.home_team} ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} / ${game.away_team} ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point}` : 'N/A',
        runLine: homeSpread ? `Home ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${fmt(homeSpread.price)}) / Away ${awaySpread?.point > 0 ? '+' : ''}${awaySpread?.point} (${fmt(awaySpread?.price)})` : 'N/A',
        total: total ? `${total}` : 'N/A',
        lineMovement,
        betPercentage: 'Available with paid Odds API tier',
        moneyPercentage: 'Available with paid Odds API tier',
        commenceTime: game.commence_time,
      };
    }
    return oddsMap;
  } catch (err) {
    console.error(`Odds API error (${sportKey}):`, err.message);
    return {};
  }
}

// ── MLB STATS API ─────────────────────────────────────────────────────────────

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

async function assembleMLBGame(g, oddsMap) {
  const home = g.teams.home.team;
  const away = g.teams.away.team;
  const homePitcher = g.teams.home.probablePitcher;
  const awayPitcher = g.teams.away.probablePitcher;
  const oddsKey = `${away.name}|${home.name}`;
  const odds = oddsMap[oddsKey] || {};
  const [homeRecord, awayRecord, homePitcherStats, awayPitcherStats, cbsPreview, espnH2H, coversH2H, rotoWireInjuries] = await Promise.all([
    fetchTeamRecord(home.id),
    fetchTeamRecord(away.id),
    fetchPitcherStats(homePitcher?.id),
    fetchPitcherStats(awayPitcher?.id),
    fetchCBSSportsPreview(away.name, home.name, 'mlb'),
    fetchESPNH2H(away.name, home.name, 'mlb'),
    fetchCoversH2H(away.name, home.name, 'mlb'),
    fetchRotoWireInjuries(away.name, home.name, 'mlb'),
  ]);
  return {
    id: g.gamePk, sport: 'MLB',
    rawTime: g.gameDate, time: formatTime(g.gameDate), date: todayStr(),
    away: away.name, home: home.name,
    awayRecord: awayRecord.overall, homeRecord: homeRecord.overall,
    awayAwayRecord: awayRecord.away, homeHomeRecord: homeRecord.home,
    awayLast5: awayRecord.last5, homeLast5: homeRecord.last5,
    awayLast10: awayRecord.last10, homeLast10: homeRecord.last10,
    awayStreak: awayRecord.streak, homeStreak: homeRecord.streak,
    awayML: odds.awayML || 'N/A', homeML: odds.homeML || 'N/A',
    runLine: odds.runLine || 'N/A',
    openingAwayML: odds.openingAwayML || 'N/A',
    openingHomeML: odds.openingHomeML || 'N/A',
    betPercentage: odds.betPercentage || 'N/A',
    moneyPercentage: odds.moneyPercentage || 'N/A',
    awayPitcher: awayPitcher?.fullName || 'TBD',
    homePitcher: homePitcher?.fullName || 'TBD',
    awayPitcherStats, homePitcherStats,
    awayBullpenERA: 'See team stats', homeBullpenERA: 'See team stats',
    awayOffense: `${awayRecord.overall} record, ${awayRecord.last10} last 10`,
    homeOffense: `${homeRecord.overall} record, ${homeRecord.last10} last 10`,
    h2hLast5: 'See MLB Stats', h2hAtHome: 'See MLB Stats',
    espnH2H, coversH2H,
    injuries: rotoWireInjuries,
    lineMovement: odds.lineMovement || 'Odds API not connected',
    cbsPreview,
    seriesGame: g.seriesGameNumber || 1,
    seriesLength: g.gamesInSeries || 3,
    slot: 'PUBLIC',
  };
}

// ── NBA GAMES ─────────────────────────────────────────────────────────────────

async function fetchNBAGames() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return assignNBASlots(NBA_MOCK_GAMES);
  try {
    const oddsMap = await fetchOdds('basketball_nba');
    if (Object.keys(oddsMap).length === 0) return assignNBASlots(NBA_MOCK_GAMES);
    const games = await Promise.all(
      Object.entries(oddsMap).map(async ([key, odds], i) => {
        const [away, home] = key.split('|');
        const [cbsPreview, espnH2H, coversH2H, rotoWireInjuries] = await Promise.all([
          fetchCBSSportsPreview(away, home, 'nba'),
          fetchESPNH2H(away, home, 'nba'),
          fetchCoversH2H(away, home, 'nba'),
          fetchRotoWireInjuries(away, home, 'nba'),
        ]);
        return {
          id: 1000 + i, sport: 'NBA', gameType: 'playoffs',
          rawTime: odds.commenceTime,
          time: formatTime(odds.commenceTime),
          date: odds.commenceTime?.split('T')[0] || todayStr(),
          away, home,
          awayRecord: 'See NBA standings', homeRecord: 'See NBA standings',
          awayAwayRecord: 'N/A', homeHomeRecord: 'N/A',
          awayLast5: 'N/A', homeLast5: 'N/A',
          awayLast10: 'N/A', homeLast10: 'N/A',
          awayStreak: 'N/A', homeStreak: 'N/A',
          awayML: odds.awayML, homeML: odds.homeML,
          openingAwayML: odds.openingAwayML, openingHomeML: odds.openingHomeML,
          spread: odds.spread, total: odds.total,
          lineMovement: odds.lineMovement,
          betPercentage: odds.betPercentage, moneyPercentage: odds.moneyPercentage,
          awayRest: 'Check schedule', homeRest: 'Check schedule',
          awayB2B: false, homeB2B: false,
          awayPPG: 'N/A', awayOppPPG: 'N/A',
          homePPG: 'N/A', homeOppPPG: 'N/A',
          awayOffRating: 'N/A', awayDefRating: 'N/A', awayPace: 'N/A',
          homeOffRating: 'N/A', homeDefRating: 'N/A', homePace: 'N/A',
          awayKeyPlayers: 'Check NBA roster', homeKeyPlayers: 'Check NBA roster',
          injuries: rotoWireInjuries,
          h2hLast5: 'N/A', h2hAtHome: 'N/A',
          seriesGame: 1, awaySeriesWins: 0, homeSeriesWins: 0,
          seriesHistory: 'N/A', cbsPreview, espnH2H, coversH2H, slot: 'PUBLIC',
        };
      })
    );
    return assignNBASlots(games);
  } catch (err) {
    console.error('NBA games error:', err.message);
    return assignNBASlots(NBA_MOCK_GAMES);
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [scheduleGames, mlbOdds, nbaGames] = await Promise.all([
      fetchMLBSchedule(),
      fetchOdds('baseball_mlb'),
      fetchNBAGames(),
    ]);

    const mlbGamesRaw = await Promise.all(
      scheduleGames.map(g => assembleMLBGame(g, mlbOdds))
    );

    mlbGamesRaw.sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
    const mlbGames = assignMLBSlots(mlbGamesRaw);
    const allGames = [...mlbGames, ...nbaGames];

    return NextResponse.json({
      games: allGames,
      trellAlerts: [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data layer error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
