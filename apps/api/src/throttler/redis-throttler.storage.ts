import { Logger } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";

/**
 * Redis-backed rate-limit storage so limits are SHARED across API instances
 * (the default in-memory store counts per-process — see PLAN.md §3/§8). Simple
 * fixed-window counter via INCR + PEXPIRE. Fails OPEN: if Redis is unreachable
 * it allows the request rather than 500-ing the whole API.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly log = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const k = `throttle:${throttlerName}:${key}`;
    try {
      const totalHits = await this.redis.incr(k);
      if (totalHits === 1) await this.redis.pexpire(k, ttl);
      let pttl = await this.redis.pttl(k);
      if (pttl < 0) {
        await this.redis.pexpire(k, ttl);
        pttl = ttl;
      }
      const isBlocked = totalHits > limit;
      const secs = Math.ceil(pttl / 1000);
      return {
        totalHits,
        timeToExpire: secs,
        isBlocked,
        timeToBlockExpire: isBlocked ? secs : 0,
      };
    } catch (e) {
      // Fail open — availability beats strict limiting if Redis blips.
      this.log.warn(`Redis throttle unavailable, allowing request: ${String(e)}`);
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
