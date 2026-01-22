/**
 * Settings Repository
 * Handles all settings-related database operations
 */
import { BaseRepository } from './base';
import { buildSettingsPayload, updateSettingsPayload, type SettingsUpdate, type AppSettings } from '../services/configService';

export class SettingsRepository extends BaseRepository {
  async getSettings(): Promise<AppSettings> {
    // Load the aggregated settings payload from the normalized tables
    return await buildSettingsPayload();
  }

  async updateSettings(data: SettingsUpdate): Promise<AppSettings> {
    // Delegate to config service to update the normalized config tables
    return await updateSettingsPayload(data as any);
  }
}
