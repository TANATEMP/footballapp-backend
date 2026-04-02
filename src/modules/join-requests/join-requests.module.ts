import { Module } from '@nestjs/common';
import { JoinRequestsService } from './join-requests.service';
import { JoinRequestsController } from './join-requests.controller';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { PlayersModule } from '../players/players.module';

@Module({
  imports: [PrismaModule, PlayersModule],
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
  exports: [JoinRequestsService],
})
export class JoinRequestsModule {}
