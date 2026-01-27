/**
 * Base Repository Class
 * Provides common utilities for all domain-specific repositories
 */
import { db } from '../db';

export abstract class BaseRepository {
  protected db = db;

  /**
   * Helper to return first result or undefined from a query
   */
  protected async findOne<T>(query: Promise<T[]>): Promise<T | undefined> {
    const results = await query;
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Helper to check if a record exists
   */
  protected async exists(query: Promise<unknown[]>): Promise<boolean> {
    const results = await query;
    return results.length > 0;
  }

  /**
   * Helper to return boolean based on result length
   */
  protected hasResults(result: unknown[]): boolean {
    return result.length > 0;
  }
}
