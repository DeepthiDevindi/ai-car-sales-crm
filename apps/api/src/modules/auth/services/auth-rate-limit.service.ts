import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';

const INCREMENT_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async assertAllowed(
    category: string,
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    let count: number;
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }

      const digest = createHash('sha256').update(identifier).digest('hex');
      count = Number(
        await this.client.eval(
          INCREMENT_WINDOW_SCRIPT,
          1,
          `auth-rate:${category}:${digest}`,
          String(windowSeconds),
        ),
      );
    } catch {
      this.logger.error('Authentication rate limiter is unavailable.');
      throw new ServiceUnavailableException('Authentication protection is unavailable.');
    }

    if (count > limit) {
      throw new HttpException('Too many requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
  }
}
