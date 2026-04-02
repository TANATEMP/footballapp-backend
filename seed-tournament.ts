/**
 * seed-tournament.ts
 * 
 * สคริปต์สำหรับเตรียมข้อมูลจำลองเพื่อทดสอบ Flow ของระบบลีกฟุตบอล
 * - ลบข้อมูลเก่าทั้งหมด (ยกเว้น User ที่เป็น ADMIN)
 * - สร้าง League ใหม่ในสถานะ REGISTRATION
 * - สร้าง Manager 6 คน พร้อมทีม 6 ทีม (APPROVED)
 * - สร้าง Player 15 คนต่อทีม
 * 
 * Usage: npx ts-node prisma/seed-tournament.ts
 */

import { PrismaClient, UserRole, TeamStatus, PlayerPosition, LeagueStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// ---- Config ----
const DEFAULT_PASSWORD = 'Password@1234';

const TEAM_DATA = [
  { name: 'Arsenal FC', shortName: 'ARS', color: '#EF0107' },
  { name: 'Chelsea FC', shortName: 'CHE', color: '#034694' },
  { name: 'Liverpool FC', shortName: 'LIV', color: '#C8102E' },
  { name: 'Manchester City', shortName: 'MCI', color: '#6CABDD' },
  { name: 'Tottenham Hotspur', shortName: 'TOT', color: '#132257' },
  { name: 'Manchester United', shortName: 'MUN', color: '#DA291C' },
];

const PLAYER_NAMES = [
  // GK
  'David Raya', 'Robert Sanchez', 'Alisson Becker', 'Ederson Moraes', 'Guglielmo Vicario', 'André Onana',
  // DEF
  'William Saliba', 'Ben White', 'Thiago Silva', 'Marc Cucurella',
  'Virgil van Dijk', 'Trent Alexander-Arnold', 'Kyle Walker', 'Rúben Dias',
  'Cristian Romero', 'Pedro Porro', 'Lisandro Martinez', 'Luke Shaw',
  // MID
  'Martin Ødegaard', 'Declan Rice', 'Enzo Fernandez', 'Cole Palmer',
  'Alexis Mac Allister', 'Dominik Szoboszlai', 'Kevin De Bruyne', 'Bernardo Silva',
  'James Maddison', 'Rodrigo Bentancur', 'Bruno Fernandes', 'Casemiro',
  // FWD
  'Bukayo Saka', 'Gabriel Jesus', 'Nicolas Jackson', 'Raheem Sterling',
  'Mohamed Salah', 'Darwin Nunez', 'Erling Haaland', 'Julian Alvarez',
  'Son Heung-min', 'Richarlison', 'Marcus Rashford', 'Rasmus Hojlund',
];

function getPosition(index: number): PlayerPosition {
  if (index < 2) return PlayerPosition.GK;
  if (index < 7) return PlayerPosition.DEF;
  if (index < 11) return PlayerPosition.MID;
  return PlayerPosition.FWD;
}

async function main() {
  console.log('🧹 Cleaning up existing data...');
  
  // Delete in dependency order
  await prisma.matchEvent.deleteMany();
  await prisma.playerStat.deleteMany();
  await prisma.leagueStanding.deleteMany();
  await prisma.match.deleteMany();
  await prisma.joinRequest.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();
  // Delete non-admin users
  await prisma.oauthAccount.deleteMany({
    where: { user: { role: { not: UserRole.ADMIN } } },
  });
  await prisma.user.deleteMany({
    where: { role: { not: UserRole.ADMIN } },
  });

  console.log('✅ Data cleaned.');

  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  if (!admin) {
    console.error('❌ No ADMIN user found! Please create one first by registering.');
    process.exit(1);
  }

  console.log(`👤 Using admin: ${admin.name} (${admin.email})`);

  // Hash password once
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  });

  // ---- Create League ----
  console.log('🏆 Creating league...');
  const league = await prisma.league.create({
    data: {
      name: 'Premier League Thailand',
      season: '2026',
      description: 'การแข่งขันฟุตบอลลีกอาชีพที่รวบรวมทีมชั้นนำจากทั่วประเทศ ชิงเงินรางวัลรวมกว่า 1,000,000 บาท พร้อมสิทธิ์เข้าแข่งขันในรายการระดับอาเซียน',
      createdBy: admin.id,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-12-31'),
      status: LeagueStatus.REGISTRATION,
      maxTeams: 6,
      minPlayers: 11,
      maxPlayers: 25,
      registrationStart: new Date(),
      registrationEnd: new Date('2026-04-30'),
      // New Scheduling Defaults
      daysOfWeek: [6, 0], // Saturday, Sunday
      startTime: '18:00',
      endTime: '22:00',
      matchDuration: 120,
      matchFormat: 'SINGLE',
    },
  });
  console.log(`  ✅ League: ${league.name} (${league.id})`);

  // ---- Create Managers, Teams, and Players ----
  for (let i = 0; i < TEAM_DATA.length; i++) {
    const teamInfo = TEAM_DATA[i];
    console.log(`\n⚽ Creating team ${i + 1}/${TEAM_DATA.length}: ${teamInfo.name}`);

    // 1. Create Manager User
    const manager = await prisma.user.create({
      data: {
        name: `Manager ${teamInfo.shortName}`,
        email: `manager.${teamInfo.shortName.toLowerCase()}@test.com`,
        passwordHash,
        role: UserRole.MANAGER,
        isActive: true,
      },
    });
    console.log(`  👤 Manager: ${manager.email}`);

    // 2. Create Team (already APPROVED and in the league)
    const team = await prisma.team.create({
      data: {
        name: teamInfo.name,
        shortName: teamInfo.shortName,
        managerId: manager.id,
        leagueId: league.id,
        status: TeamStatus.APPROVED,
      },
    });
    console.log(`  🛡️  Team: ${team.name} (${team.shortName})`);

    // 3. Create Players for this team
    const playersPerTeam = 15;
    const startIdx = i * playersPerTeam;

    for (let j = 0; j < playersPerTeam; j++) {
      const nameIdx = (startIdx + j) % PLAYER_NAMES.length;
      const playerName = j < PLAYER_NAMES.length 
        ? `${PLAYER_NAMES[nameIdx]}` 
        : `Player ${teamInfo.shortName}-${j + 1}`;
      
      await prisma.player.create({
        data: {
          name: playerName,
          number: j + 1,
          position: getPosition(j),
          teamId: team.id,
          // No userId — these are dummy players without accounts
        },
      });
    }
    console.log(`  👥 Created ${playersPerTeam} players`);
  }

  // ---- Create LeagueStandings for each approved team ----
  console.log('\n📊 Initializing league standings...');
  const approvedTeams = await prisma.team.findMany({
    where: { leagueId: league.id, status: TeamStatus.APPROVED },
  });

  for (const team of approvedTeams) {
    await prisma.leagueStanding.create({
      data: {
        leagueId: league.id,
        teamId: team.id,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      },
    });
  }
  console.log(`  ✅ Created standings for ${approvedTeams.length} teams`);

  // ---- Summary ----
  console.log('\n' + '='.repeat(60));
  console.log('🎉 SEED COMPLETE!');
  console.log('='.repeat(60));
  console.log(`  League:    ${league.name} (${league.status})`);
  console.log(`  League ID: ${league.id}`);
  console.log(`  Teams:     ${TEAM_DATA.length} (all APPROVED)`);
  console.log(`  Players:   ${TEAM_DATA.length * 15}`);
  console.log('');
  console.log('📋 Test Flow:');
  console.log('  1. Login as Admin');
  console.log('  2. Go to League Detail → Overview');
  console.log('  3. Click "Close Registration & Prepare Season"');
  console.log('  4. Click "Generate Fixtures"');
  console.log('  5. Check Matches tab for DRAFT matches');
  console.log('  6. Click "Start Season"');
  console.log('');
  console.log('🔑 Manager Accounts (password: Password@1234):');
  for (const t of TEAM_DATA) {
    console.log(`  manager.${t.shortName.toLowerCase()}@test.com`);
  }
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
