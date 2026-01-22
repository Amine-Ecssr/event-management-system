/**
 * Aggregation Cache
 * 
 * In-memory cache for Elasticsearch aggregation results.
 * Reduces load on ES for frequently accessed analytics data.
 * 
 * @module cache/aggregation-cache
 */

import type { CacheEntry } from '../elasticsearch/types/aggregations.types';

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,       // 1 minute - for real-time data
  MEDIUM: 5 * 60 * 1000,      // 5 minutes - default
  LONG: 15 * 60 * 1000,       // 15 minutes - for stable data
  EXTENDED: 60 * 60 * 1000,   // 1 hour - for historical data
} as const;

/**
 * In-memory cache for aggregation results
 */
class AggregationCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL = CACHE_TTL.MEDIUM;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Retrieve data from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[Cache] Invalidated ${count} entries matching "${pattern}"`);
    }
    return count;
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`[Cache] Invalidated all ${count} entries`);
  }

  /**
   * Build a consistent cache key from method name and parameters
   */
  buildKey(method: string, params: Record<string, unknown> = {}): string {
    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        const value = params[key];
        // Convert dates to ISO strings
        if (value instanceof Date) {
          acc[key] = value.toISOString();
        } else if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, unknown>);

    const paramsStr = Object.keys(sortedParams).length > 0 
      ? `:${JSON.stringify(sortedParams)}` 
      : '';
    
    return `agg:${method}${paramsStr}`;
  }

  /**
   * Get or compute cached value
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await compute();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: { key: string; age: number; ttl: number }[] } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((now - entry.timestamp) / 1000),
      ttl: Math.round(entry.ttl / 1000),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Shutdown the cache (stop cleanup interval)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const aggregationCache = new AggregationCache();

// Export class for testing
export { AggregationCache };
