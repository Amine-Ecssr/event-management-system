import { db } from '../db';
import { events, categories } from '@shared/schema.mssql';
import { eq, and } from 'drizzle-orm';
import type { InsertEvent } from '@shared/schema.mssql';
import type { ScrapedEvent } from '@shared/scraper-types';
import { scraperClient } from '../scraper-client';

interface ScrapeResult {
  added: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

export class ScraperService {
  // Helper method to find or create a category
  private async findOrCreateCategory(nameEn: string, nameAr?: string): Promise<number> {
    // Try to find existing category
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.nameEn, nameEn))
      .offset(1);
    
    if (existing) {
      // Update Arabic name if provided and different
      if (nameAr && existing.nameAr !== nameAr) {
        await db
          .update(categories)
          .set({ nameAr })
          .where(eq(categories.id, existing.id));
      }
      return existing.id;
    }
    
    // Create new category
    const [newCategory] = await db
      .insert(categories)
      .values({ nameEn, nameAr })
      .returning();
    
    return newCategory.id;
  }
  
  async scrapeAbuDhabiEvents(options: { startFromJanuary?: boolean } = {}): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      added: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };
    
    try {
      console.log('[Scraper Service] Starting Abu Dhabi events sync...');
      
      // Fetch events for current year and next year via the scraper microservice
      const scrapedEvents = await scraperClient.fetchAbuDhabiEvents({
        startFromJanuary: options.startFromJanuary ?? false,
      });
      
      console.log(`[Scraper Service] Fetched ${scrapedEvents.length} events from Abu Dhabi Media Office`);
      
      // Get all existing scraped events from Abu Dhabi
      const existingEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.source, 'abu-dhabi-media-office'),
            eq(events.isScraped, true)
          )
        );
      
      const existingEventsMap = new Map(
        existingEvents.map(e => [e.externalId, e])
      );
      
      // Create a set of scraped external IDs for deletion check
      const scrapedExternalIds = new Set(
        scrapedEvents.map(e => e.externalId)
      );
      
      // Process each scraped event
      for (const scrapedEvent of scrapedEvents) {
        try {
          const existingEvent = existingEventsMap.get(scrapedEvent.externalId);
          
          // Find or create category
          const categoryId = await this.findOrCreateCategory(
            scrapedEvent.category,
            scrapedEvent.categoryAr
          );
          
          if (existingEvent) {
            // Event already exists
            if (existingEvent.adminModified) {
              // Skip admin-modified events to preserve admin changes
              console.log(`[Scraper Service] Skipping admin-modified event: ${scrapedEvent.name}`);
              result.skipped++;
              continue;
            }
            
            // Update existing event with fresh data
            await db
              .update(events)
              .set({
                name: scrapedEvent.name,
                nameAr: scrapedEvent.nameAr,
                description: scrapedEvent.description,
                descriptionAr: scrapedEvent.descriptionAr,
                startDate: scrapedEvent.startDate,
                endDate: scrapedEvent.endDate,
                location: scrapedEvent.location,
                locationAr: scrapedEvent.locationAr,
                organizers: scrapedEvent.organizers,
                organizersAr: scrapedEvent.organizersAr,
                url: scrapedEvent.url,
                categoryId: categoryId,
              })
              .where(eq(events.id, existingEvent.id));
            
            result.updated++;
            console.log(`[Scraper Service] Updated event: ${scrapedEvent.name}`);
          } else {
            // New event - insert it
            const newEvent: InsertEvent = {
              name: scrapedEvent.name,
              nameAr: scrapedEvent.nameAr,
              description: scrapedEvent.description,
              descriptionAr: scrapedEvent.descriptionAr,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              location: scrapedEvent.location,
              locationAr: scrapedEvent.locationAr,
              organizers: scrapedEvent.organizers,
              organizersAr: scrapedEvent.organizersAr,
              url: scrapedEvent.url,
              categoryId: categoryId,
              eventType: 'local',
              eventScope: 'external',
              isScraped: true,
              source: 'abu-dhabi-media-office',
              externalId: scrapedEvent.externalId,
              adminModified: false,
              reminder1Week: false,
              reminder1Day: false,
              reminderWeekly: false,
              reminderDaily: false,
              reminderMorningOf: false,
            };
            
            await db.insert(events).values(newEvent);
            result.added++;
            console.log(`[Scraper Service] Added new event: ${scrapedEvent.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to process event "${scrapedEvent.name}": ${error}`;
          console.error(`[Scraper Service] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
      
      // Delete events that are no longer on the Abu Dhabi page
      // SAFETY: Only delete if we actually fetched events successfully
      // If scrape returned 0 events, it could be a transient error (network, HTML change, rate limit)
      // so we skip deletion to avoid purging all events
      if (scrapedEvents.length > 0) {
        // Only delete events that:
        // 1. Are scraped from Abu Dhabi Media Office
        // 2. Have NOT been admin-modified
        // 3. Are NOT in the current scraped list
        for (const existingEvent of existingEvents) {
          if (!existingEvent.adminModified && existingEvent.externalId && !scrapedExternalIds.has(existingEvent.externalId)) {
            try {
              await db
                .delete(events)
                .where(eq(events.id, existingEvent.id));
              
              result.deleted++;
              console.log(`[Scraper Service] Deleted removed event: ${existingEvent.name}`);
            } catch (error) {
              const errorMsg = `Failed to delete event "${existingEvent.name}": ${error}`;
              console.error(`[Scraper Service] ${errorMsg}`);
              result.errors.push(errorMsg);
            }
          }
        }
      } else {
        console.warn('[Scraper Service] Scrape returned 0 events - skipping deletion to avoid data loss from transient errors');
      }
      
      console.log('[Scraper Service] Sync complete:', result);
      return result;
    } catch (error) {
      console.error('[Scraper Service] Fatal error during scraping:', error);
      result.errors.push(`Fatal error: ${error}`);
      return result;
    }
  }
  
  async scrapeAdnecEvents(): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      added: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };
    
    try {
      console.log('[Scraper Service] Starting ADNEC events sync...');
      
      // Fetch events from ADNEC via the scraper microservice
      const scrapedEvents = await scraperClient.fetchAdnecEvents();
      
      console.log(`[Scraper Service] Fetched ${scrapedEvents.length} events from ADNEC`);
      
      // Get all existing scraped events from ADNEC
      const existingEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.source, 'adnec'),
            eq(events.isScraped, true)
          )
        );
      
      const existingEventsMap = new Map(
        existingEvents.map(e => [e.externalId, e])
      );
      
      // Create a set of scraped external IDs for deletion check
      const scrapedExternalIds = new Set(
        scrapedEvents.map(e => e.externalId)
      );
      
      // Process each scraped event
      for (const scrapedEvent of scrapedEvents) {
        try {
          const existingEvent = existingEventsMap.get(scrapedEvent.externalId);
          
          // Find or create category
          const categoryId = await this.findOrCreateCategory(
            scrapedEvent.category,
            scrapedEvent.categoryAr
          );
          
          if (existingEvent) {
            // Event already exists
            if (existingEvent.adminModified) {
              // Skip admin-modified events to preserve admin changes
              console.log(`[Scraper Service] Skipping admin-modified event: ${scrapedEvent.name}`);
              result.skipped++;
              continue;
            }
            
            // Update existing event with fresh data
            await db
              .update(events)
              .set({
                name: scrapedEvent.name,
                nameAr: scrapedEvent.nameAr,
                description: scrapedEvent.description,
                descriptionAr: scrapedEvent.descriptionAr,
                startDate: scrapedEvent.startDate,
                endDate: scrapedEvent.endDate,
                location: scrapedEvent.location,
                locationAr: scrapedEvent.locationAr,
                organizers: scrapedEvent.organizers,
                organizersAr: scrapedEvent.organizersAr,
                url: scrapedEvent.url,
                categoryId: categoryId,
              })
              .where(eq(events.id, existingEvent.id));
            
            result.updated++;
            console.log(`[Scraper Service] Updated event: ${scrapedEvent.name}`);
          } else {
            // New event - insert it
            const newEvent: InsertEvent = {
              name: scrapedEvent.name,
              nameAr: scrapedEvent.nameAr,
              description: scrapedEvent.description,
              descriptionAr: scrapedEvent.descriptionAr,
              startDate: scrapedEvent.startDate,
              endDate: scrapedEvent.endDate,
              location: scrapedEvent.location,
              locationAr: scrapedEvent.locationAr,
              organizers: scrapedEvent.organizers,
              organizersAr: scrapedEvent.organizersAr,
              url: scrapedEvent.url,
              categoryId: categoryId,
              eventType: 'local',
              eventScope: 'external',
              isScraped: true,
              source: 'adnec',
              externalId: scrapedEvent.externalId,
              adminModified: false,
              reminder1Week: false,
              reminder1Day: false,
              reminderWeekly: false,
              reminderDaily: false,
              reminderMorningOf: false,
            };
            
            await db.insert(events).values(newEvent);
            result.added++;
            console.log(`[Scraper Service] Added new event: ${scrapedEvent.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to process event "${scrapedEvent.name}": ${error}`;
          console.error(`[Scraper Service] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
      
      // Delete events that are no longer on the ADNEC page
      if (scrapedEvents.length > 0) {
        for (const existingEvent of existingEvents) {
          if (!existingEvent.adminModified && existingEvent.externalId && !scrapedExternalIds.has(existingEvent.externalId)) {
            try {
              await db
                .delete(events)
                .where(eq(events.id, existingEvent.id));
              
              result.deleted++;
              console.log(`[Scraper Service] Deleted removed event: ${existingEvent.name}`);
            } catch (error) {
              const errorMsg = `Failed to delete event "${existingEvent.name}": ${error}`;
              console.error(`[Scraper Service] ${errorMsg}`);
              result.errors.push(errorMsg);
            }
          }
        }
      } else {
        console.warn('[Scraper Service] Scrape returned 0 events - skipping deletion to avoid data loss from transient errors');
      }
      
      console.log('[Scraper Service] ADNEC sync complete:', result);
      return result;
    } catch (error) {
      console.error('[Scraper Service] Fatal error during ADNEC scraping:', error);
      result.errors.push(`Fatal error: ${error}`);
      return result;
    }
  }
  
  async scrapeAllSources(options: { startFromJanuary?: boolean } = {}): Promise<{ abuDhabi: ScrapeResult; adnec: ScrapeResult }> {
    console.log('[Scraper Service] Starting sync from all sources...');
    
    const [abuDhabi, adnec] = await Promise.all([
      this.scrapeAbuDhabiEvents(options),
      this.scrapeAdnecEvents(),
    ]);
    
    console.log('[Scraper Service] All sources sync complete');
    console.log('[Scraper Service] Abu Dhabi Media Office:', abuDhabi);
    console.log('[Scraper Service] ADNEC:', adnec);
    
    return { abuDhabi, adnec };
  }

  async markEventAsAdminModified(eventId: string): Promise<void> {
    await db
      .update(events)
      .set({ adminModified: true })
      .where(eq(events.id, eventId));
  }
}

export const scraperService = new ScraperService();
