
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      events: {
        where: { eventType: 'GOAL' },
        include: { player: { select: { name: true } } }
      }
    },
    orderBy: { matchDate: 'desc' },
    take: 10
  });

  console.log('--- Matches in Database ---');
  matches.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`Teams: ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    console.log(`Score: ${m.homeScore} - ${m.awayScore}`);
    console.log(`Goal Events Count: ${m.events.length}`);
    m.events.forEach(e => {
        console.log(`   Goal: ${e.player?.name} (${e.minute}')`);
    });
    console.log('---------------------------');
  });
}

main().finally(() => prisma.$disconnect());
