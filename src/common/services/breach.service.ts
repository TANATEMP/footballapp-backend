import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class BreachService {
  private readonly logger = new Logger(BreachService.name);

  async isPasswordPwned(password: string): Promise<boolean> {
    try {
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      
      if (!response.ok) {
        this.logger.error(`HIBP API returned ${response.status}`);
        return false; // Fail safe
      }

      const body = await response.text();
      const lines = body.split('\n');

      for (const line of lines) {
        const [h, count] = line.split(':');
        if (h.trim() === suffix) {
          return parseInt(count.trim(), 10) > 0;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking password breach:', error);
      return false; // Fail safe
    }
  }
}
