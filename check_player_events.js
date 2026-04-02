
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'player@test.com' },
    include: {
      playerProfile: {
        include: {
          events: {
             include: { match: { include: { homeTeam: true, awayTeam: true } } }
          }
        }
      }
    }
  });

  if (!user || !user.playerProfile) {
    console.log('No player profile found');
    return;
  }

  console.log('--- Player Events ---');
  user.playerProfile.events.forEach(e => {
    console.log(`Match: ${e.match.homeTeam.name} vs ${e.match.awayTeam.name}`);
    console.log(`Event: ${e.eventType} at ${e.minute}'`);
    console.log(`Match DB Score: ${e.match.homeScore} - ${e.match.awayScore}`);
    console.log('---------------------------');
  });
}

main().finally(() => prisma.$disconnect());
