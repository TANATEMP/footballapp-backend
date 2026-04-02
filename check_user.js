
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'player@test.com' },
    include: {
      playerProfile: {
        include: {
          team: {
            include: {
              league: true,
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  const teamId = user.playerProfile?.teamId;
  console.log('--- User Info ---');
  console.log('ID:', user.id);
  console.log('Role:', user.role);
  console.log('Player Profile:', !!user.playerProfile);
  console.log('Team ID:', teamId);

  if (teamId) {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });
    console.log('--- Matches Found:', matches.length, '---');
    matches.forEach(m => {
      console.log(`Match ID: ${m.id}, Date: ${m.matchDate}, Status: ${m.status}, Score: ${m.homeScore}-${m.awayScore}`);
    });

    const team = user.playerProfile.team;
    console.log('--- Team & League Info ---');
    console.log('Team Name:', team.name);
    console.log('League Status:', team.league?.status);
  }
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
