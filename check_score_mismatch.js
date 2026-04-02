
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    include: {
      events: {
        where: { eventType: 'GOAL' }
      },
      homeTeam: true,
      awayTeam: true
    }
  });

  console.log('--- Result Consistency Check ---');
  matches.forEach(m => {
    const homeGoals = m.events.filter(e => e.teamId === m.homeTeamId).length;
    const awayGoals = m.events.filter(e => e.teamId === m.awayTeamId).length;
    
    if (homeGoals !== m.homeScore || awayGoals !== m.awayScore) {
      console.log(`[MISMATCH] Match: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
      console.log(`DB Score: ${m.homeScore} - ${m.awayScore}`);
      console.log(`Goal Events: ${homeGoals} - ${awayGoals}`);
      console.log('---------------------------');
    } else {
        console.log(`[OK] Match: ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.homeScore}-${m.awayScore})`);
    }
  });
}

main().finally(() => prisma.$disconnect());
