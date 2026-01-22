import * as cheerio from 'cheerio';
import { format, parse, isValid } from 'date-fns';
import type { ScrapedEvent } from '@shared/scraper-types';

interface ArabicEventData {
  nameAr: string;
  descriptionAr: string;
  locationAr: string;
  organizersAr: string;
  categoryAr?: string;
}

export class AbuDhabiEventsScraper {
  private baseUrl = 'https://www.mediaoffice.abudhabi/en/abu-dhabi-events/';
  private sectorMapping: Map<string, string> = new Map();
  private sectorMappingAr: Map<string, string> = new Map();
  
  private async fetchWithRetry(url: string, retries = 3): Promise<string | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[AbuDhabi Scraper] Fetching: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.text();
      } catch (error) {
        console.error(`[AbuDhabi Scraper] Attempt ${attempt + 1} failed:`, error);
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return null;
  }
  
  private getMonthUrl(month: number, year: number): string {
    return `${this.baseUrl}?month=${month}&year=${year}`;
  }
  
  private extractSectorMapping($: cheerio.CheerioAPI): void {
    // Extract sector/category mappings from filter checkboxes
    $('.calendar-events-filter-sectors input[type="checkbox"]').each((_, element) => {
      const $input = $(element);
      const sectorId = $input.attr('value') || '';
      const sectorName = $input.attr('data-label') || '';
      
      if (sectorId && sectorName) {
        this.sectorMapping.set(sectorId, sectorName);
      }
    });
    
    console.log(`[AbuDhabi Scraper] Loaded ${this.sectorMapping.size} sector mappings`);
  }
  
  private async fetchArabicSectorMappings(month: number, year: number): Promise<void> {
    try {
      // Get Arabic calendar page URL
      const arabicUrl = `https://www.mediaoffice.abudhabi/ar/abu-dhabi-events/?month=${month}&year=${year}`;
      
      console.log(`[AbuDhabi Scraper] Fetching Arabic sector mappings from: ${arabicUrl}`);
      
      const html = await this.fetchWithRetry(arabicUrl, 2);
      
      if (!html) {
        console.warn(`[AbuDhabi Scraper] Could not fetch Arabic calendar page`);
        return;
      }
      
      const $ = cheerio.load(html);
      
      // Extract Arabic sector/category mappings from filter checkboxes
      $('.calendar-events-filter-sectors input[type="checkbox"]').each((_, element) => {
        const $input = $(element);
        const sectorId = $input.attr('value') || '';
        const sectorName = $input.attr('data-label') || '';
        
        if (sectorId && sectorName) {
          this.sectorMappingAr.set(sectorId, sectorName);
        }
      });
      
      console.log(`[AbuDhabi Scraper] Loaded ${this.sectorMappingAr.size} Arabic sector mappings`);
    } catch (error) {
      console.error(`[AbuDhabi Scraper] Error fetching Arabic sector mappings:`, error);
    }
  }
  
  private async fetchArabicEventData(englishUrl: string, sectorId: string): Promise<ArabicEventData | null> {
    try {
      // Convert English URL to Arabic URL
      const arabicUrl = englishUrl.replace('/en/', '/ar/');
      
      console.log(`[AbuDhabi Scraper] Fetching Arabic version: ${arabicUrl}`);
      
      const html = await this.fetchWithRetry(arabicUrl, 2); // Use fewer retries for individual pages
      
      if (!html) {
        console.warn(`[AbuDhabi Scraper] Could not fetch Arabic page: ${arabicUrl}`);
        return null;
      }
      
      const $ = cheerio.load(html);
      
      // Extract Arabic event details
      // Based on common event page structures, we'll try multiple selectors
      
      // Extract Arabic title
      let nameAr = $('h1.event-title').first().text().trim();
      if (!nameAr) {
        nameAr = $('h1').first().text().trim();
      }
      
      // Extract Arabic description
      let descriptionAr = $('.event-description').text().trim();
      if (!descriptionAr) {
        descriptionAr = $('.description').text().trim();
      }
      if (!descriptionAr) {
        // Try to get the first few paragraphs
        descriptionAr = $('p').first().text().trim();
      }
      
      // Extract Arabic location
      let locationAr = $('.event-location').text().trim();
      if (!locationAr) {
        locationAr = $('span.location').text().trim();
      }
      if (!locationAr) {
        // Try to find location in the metadata
        locationAr = $('[class*="location"]').first().text().trim();
      }
      
      // Extract Arabic organizers - default to Arabic version of "Abu Dhabi Government"
      let organizersAr = 'حكومة أبوظبي';
      const organizerElement = $('.event-organizer').text().trim() || 
                               $('.organizer').text().trim() ||
                               $('[class*="organiz"]').first().text().trim();
      if (organizerElement) {
        organizersAr = organizerElement;
      }
      
      // Get Arabic category from the mapping
      const categoryAr = this.sectorMappingAr.get(sectorId) || undefined;
      
      // Return the Arabic data
      return {
        nameAr: nameAr || '',
        descriptionAr: descriptionAr || '',
        locationAr: locationAr || '',
        organizersAr: organizersAr,
        categoryAr: categoryAr,
      };
    } catch (error) {
      console.error(`[AbuDhabi Scraper] Error fetching Arabic data for ${englishUrl}:`, error);
      return null;
    }
  }
  
  private extractEventsFromPage($: cheerio.CheerioAPI, baseUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();
    
    // Extract sector mappings if not already loaded
    if (this.sectorMapping.size === 0) {
      this.extractSectorMapping($);
    }
    
    // Find all event cards with the specific structure
    $('a.event-card.filterable').each((_, element) => {
      const $element = $(element);
      
      // Extract data-date attribute (space-separated dates in YYYY-MM-DD format)
      const dataDate = $element.attr('data-date');
      if (!dataDate) {
        return;
      }
      
      // Parse dates - split by space to get all dates
      const dates = dataDate.trim().split(/\s+/);
      const startDate = dates[0] || '';
      const endDate = dates[dates.length - 1] || startDate;
      
      // Skip if no valid dates
      if (!startDate) {
        return;
      }
      
      // Extract external ID
      const externalId = $element.attr('data-event-id') || '';
      
      // Extract sector/category
      const dataSector = $element.attr('data-sector') || '';
      const category = this.sectorMapping.get(dataSector) || 'General';
      
      // Extract event URL
      const href = $element.attr('href') || '';
      const eventUrl = href.startsWith('http') 
        ? href 
        : new URL(href, baseUrl).href;
      
      // Skip if already seen
      if (seen.has(eventUrl)) {
        return;
      }
      seen.add(eventUrl);
      
      // Extract event name from h2.title
      const name = $element.find('h2.title').text().trim();
      if (!name) {
        return;
      }
      
      // Extract location from span.location
      const location = $element.find('span.location').text().trim();
      
      events.push({
        name,
        url: eventUrl,
        startDate,
        endDate,
        location,
        organizers: 'Abu Dhabi Government',
        category,
        description: name,
        externalId: externalId || eventUrl,
        sectorId: dataSector, // Store sectorId for Arabic category lookup
      });
    });
    
    return events;
  }
  
  async fetchEventsForMonth(month: number, year: number): Promise<ScrapedEvent[]> {
    const url = this.getMonthUrl(month, year);
    const html = await this.fetchWithRetry(url);
    
    if (!html) {
      return [];
    }
    
    const $ = cheerio.load(html);
    
    // Extract events using the new method
    const events = this.extractEventsFromPage($, url);
    
    // Fetch Arabic sector mappings
    await this.fetchArabicSectorMappings(month, year);
    
    // Fetch Arabic content for each event
    console.log(`[AbuDhabi Scraper] Fetching Arabic content for ${events.length} events`);
    
    for (const event of events) {
      try {
        const arabicData = await this.fetchArabicEventData(event.url, event.sectorId || '');
        
        if (arabicData) {
          event.nameAr = arabicData.nameAr;
          event.descriptionAr = arabicData.descriptionAr;
          event.locationAr = arabicData.locationAr;
          event.organizersAr = arabicData.organizersAr;
          event.categoryAr = arabicData.categoryAr;
          
          console.log(`[AbuDhabi Scraper] ✓ Fetched Arabic data for: ${event.name}`);
        } else {
          console.warn(`[AbuDhabi Scraper] ✗ Could not fetch Arabic data for: ${event.name}`);
        }
        
        // Be nice to the server - add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[AbuDhabi Scraper] Error fetching Arabic data for ${event.name}:`, error);
        // Continue with next event even if one fails
      }
    }
    
    return events;
  }
  
  async fetchEventsForDateRange(startMonth: number, startYear: number, endMonth: number, endYear: number): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];
    
    let currentMonth = startMonth;
    let currentYear = startYear;
    let consecutiveEmptyMonths = 0;
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      console.log(`[AbuDhabi Scraper] Fetching events for ${currentMonth}/${currentYear}`);
      
      const monthEvents = await this.fetchEventsForMonth(currentMonth, currentYear);
      allEvents.push(...monthEvents);
      
      console.log(`[AbuDhabi Scraper] Found ${monthEvents.length} events`);
      
      // Track consecutive empty months
      if (monthEvents.length === 0) {
        consecutiveEmptyMonths++;
        console.log(`[AbuDhabi Scraper] Consecutive empty months: ${consecutiveEmptyMonths}`);
        
        // Stop if we've found 2 consecutive months with no events
        if (consecutiveEmptyMonths >= 2) {
          console.log('[AbuDhabi Scraper] Stopping early: 2 consecutive months with no events');
          break;
        }
      } else {
        // Reset counter if we find events
        consecutiveEmptyMonths = 0;
      }
      
      // Move to next month
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final deduplication
    const uniqueEvents = Array.from(
      new Map(allEvents.map(event => [event.externalId, event])).values()
    );
    
    return uniqueEvents;
  }
  
  async fetchCurrentAndNextYear(startFromJanuary: boolean = false): Promise<ScrapedEvent[]> {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Start from January if manually triggered, otherwise start from current month
    const startMonth = startFromJanuary ? 1 : now.getMonth() + 1;
    const startYear = currentYear;
    
    // Calculate end date (18 months from now)
    const monthsAhead = 18;
    const endDate = new Date(currentYear, now.getMonth() + monthsAhead, 1);
    const endMonth = endDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    
    console.log(`[AbuDhabi Scraper] Fetching events from ${startMonth}/${startYear} to ${endMonth}/${endYear} ${startFromJanuary ? '(from January of current year)' : '(18 months from now)'}`);
    
    return this.fetchEventsForDateRange(startMonth, startYear, endMonth, endYear);
  }
}
