
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find a completed match
  const match = await prisma.match.findFirst({
    where: { status: 'COMPLETED' },
    include: { homeTeam: true, awayTeam: true }
  });

  if (!match) {
    console.log('No completed match found to test.');
    return;
  }

  console.log(`Testing with Match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
  console.log(`Original Score: ${match.homeScore} - ${match.awayScore}`);

  const getStandings = async (teamId) => {
    return prisma.leagueStanding.findFirst({
      where: { leagueId: match.leagueId, teamId }
    });
  };

  const homeOld = await getStandings(match.homeTeamId);
  console.log(`Home Team Standings (Before): Points=${homeOld.points}, GF=${homeOld.goalsFor}`);

  // We simulate the service logic here because we can't easily call the NestJS service from a raw script
  // But we want to see if our logic works.
  
  // New Score: Increment home score by 1
  const newHomeScore = match.homeScore + 1;
  const newMatch = { ...match, homeScore: newHomeScore };

  // This is the logic I implemented in the service
  const syncStandings = async (oldM, newM) => {
      const getStats = (m) => {
        if (!m || m.status !== 'COMPLETED') return null;
        const hWin = m.homeScore > m.awayScore;
        const draw = m.homeScore === m.awayScore;
        const aWin = m.homeScore < m.awayScore;
        return {
          home: { played: 1, won: hWin ? 1 : 0, drawn: draw ? 1 : 0, lost: aWin ? 1 : 0, gf: m.homeScore, ga: m.awayScore, pts: hWin ? 3 : draw ? 1 : 0 }
        };
      };
      const oldS = getStats(oldM);
      const newS = getStats(newM);
      const delta = {
          gf: (newS.home.gf || 0) - (oldS.home.gf || 0),
          pts: (newS.home.pts || 0) - (oldS.home.pts || 0)
      };
      
      await prisma.leagueStanding.update({
          where: { id: homeOld.id },
          data: {
              goalsFor: { increment: delta.gf },
              points: { increment: delta.pts }
          }
      });
  };

  console.log('Updating score to ' + newHomeScore + '-' + match.awayScore);
  await syncStandings(match, newMatch);
  // Also update match itself
  await prisma.match.update({ where: { id: match.id }, data: { homeScore: newHomeScore } });

  const homeNew = await getStandings(match.homeTeamId);
  console.log(`Home Team Standings (After): Points=${homeNew.points}, GF=${homeNew.goalsFor}`);

  if (homeNew.goalsFor === homeOld.goalsFor + 1) {
      console.log('SUCCESS: Standings updated correctly!');
  } else {
      console.log('FAILURE: Standings did not update as expected.');
  }
  
  // Revert change to keep DB clean
  await prisma.match.update({ where: { id: match.id }, data: { homeScore: match.homeScore } });
  await prisma.leagueStanding.update({ where: { id: homeOld.id }, data: { goalsFor: homeOld.goalsFor, points: homeOld.points } });
}

main().finally(() => prisma.$disconnect());
