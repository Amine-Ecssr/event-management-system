import { scraperService } from './services/scraperService';

class ScraperSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  /**
   * Start the scraper scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log('[Scraper Scheduler] Already running');
      return;
    }
    
    console.log('[Scraper Scheduler] Starting weekly events sync scheduler (Abu Dhabi Media Office + ADNEC)...');
    
    // Set up interval to run weekly (do NOT run immediately on start)
    this.intervalId = setInterval(() => {
      this.runScraper().catch(error => {
        console.error('[Scraper Scheduler] Error in scheduled scraping:', error);
      });
    }, this.WEEKLY_INTERVAL_MS);
    
    console.log('[Scraper Scheduler] Weekly scheduler started (runs every 7 days)');
    console.log('[Scraper Scheduler] Next run will be in 7 days');
  }
  
  /**
   * Stop the scraper scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scraper Scheduler] Stopped');
    }
  }
  
  /**
   * Run the scraper manually
   */
  async runScraper(): Promise<void> {
    try {
      console.log('[Scraper Scheduler] Starting scheduled events sync from all sources...');
      const result = await scraperService.scrapeAllSources();
      console.log('[Scraper Scheduler] Sync completed:', result);
    } catch (error) {
      console.error('[Scraper Scheduler] Scraping failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
let schedulerInstance: ScraperSchedulerService | null = null;

export function startScraperScheduler(): void {
  if (!schedulerInstance) {
    schedulerInstance = new ScraperSchedulerService();
  }
  schedulerInstance.start();
}

export function stopScraperScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

export function runScraperNow(): Promise<void> {
  if (!schedulerInstance) {
    schedulerInstance = new ScraperSchedulerService();
  }
  return schedulerInstance.runScraper();
}
