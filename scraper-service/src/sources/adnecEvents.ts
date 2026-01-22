import * as cheerio from 'cheerio';
import { format, parse, isValid } from 'date-fns';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import type { ScrapedEvent } from '@shared/scraper-types';

// Add stealth plugin to avoid bot detection
puppeteerExtra.use(StealthPlugin());

interface EventJsonLd {
  '@type': string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  location?: {
    '@type': string;
    name?: string;
    address?: any;
  };
  organizer?: {
    '@type': string;
    name?: string;
    url?: string;
  };
  image?: string | string[];
}

export class AdnecEventsScraper {
  private baseUrlEn = 'https://www.adnec.ae/en/eventlisting';
  private baseUrlAr = 'https://www.adnec.ae/ar/eventlisting';
  private sitemapUrl = 'https://www.adnec.ae/sitemap.xml';

  private async collectEventUrlsFromPage(page: Page, baseUrl: string): Promise<Set<string>> {
    const urls = await page.evaluate((base: string) => {
      const doc = (globalThis as any).document as any;
      const links = Array.from(doc?.querySelectorAll?.('a[href*="/eventlisting/"]') ?? []);
      const seen = new Set<string>();

      links.forEach(link => {
        const element = link as any;
        const href = element?.getAttribute?.('href') || '';

        if (!href) return;

        try {
          const fullUrl = href.startsWith('http') ? href : new URL(href, base).href;
          const hasSlug = /\/eventlisting\/[^/\?#]+/.test(fullUrl);

          if (hasSlug && !fullUrl.endsWith('/eventlisting')) {
            seen.add(fullUrl);
          }
        } catch (error) {
          // Ignore malformed URLs
        }
      });

      return Array.from(seen);
    }, baseUrl);

    return new Set(urls);
  }

  private async fetchListingUrlsWithPuppeteer(baseUrl: string): Promise<string[]> {
    if (process.env.ENABLE_PUPPETEER !== 'true') {
      console.log('[ADNEC Scraper] Puppeteer disabled, skipping browser fetch');
      return [];
    }

    const executablePath =
      process.env.PUPPETEER_BROWSER_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;

    if (!executablePath) {
      console.log('[ADNEC Scraper] Puppeteer enabled but no browser path provided; skipping');
      return [];
    }

    console.log(`[ADNEC Scraper] Using Puppeteer to load listings: ${baseUrl}`);
    console.log(`[ADNEC Scraper] Browser path: ${executablePath}`);

    let browser: Browser | null = null;

    try {
      console.log('[ADNEC Scraper] Launching browser...');
      browser = await puppeteerExtra.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
        executablePath,
      });
      console.log('[ADNEC Scraper] Browser launched successfully');

      const page = await browser.newPage();
      console.log('[ADNEC Scraper] New page created');

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      });

      // Add request interception logging
      page.on('request', (request) => {
        if (request.resourceType() === 'document') {
          console.log(`[ADNEC Scraper] Requesting: ${request.url()}`);
        }
      });
      
      page.on('response', (response) => {
        if (response.request().resourceType() === 'document') {
          console.log(`[ADNEC Scraper] Response: ${response.status()} from ${response.url()}`);
        }
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log(`[ADNEC Scraper] Page console error: ${msg.text()}`);
        }
      });

      console.log(`[ADNEC Scraper] Navigating to ${baseUrl}...`);
      
      // Try with 'domcontentloaded' first which is faster, then wait for network
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('[ADNEC Scraper] DOM content loaded, waiting for network idle...');
        await page.waitForNetworkIdle({ timeout: 30000 }).catch(() => {
          console.log('[ADNEC Scraper] Network idle timeout, continuing anyway');
        });
      } catch (navError) {
        console.error('[ADNEC Scraper] Navigation error:', navError);
        throw navError;
      }

      console.log('[ADNEC Scraper] Page loaded, checking content...');
      
      // Log page title and content length for debugging
      const pageTitle = await page.title();
      const contentLength = await page.evaluate(() => document.body?.innerHTML?.length || 0);
      console.log(`[ADNEC Scraper] Page title: "${pageTitle}", Content length: ${contentLength} chars`);

      const collectedUrls = new Set<string>();
      let stagnantRounds = 0;

      for (let attempt = 0; attempt < 6; attempt++) {
        const beforeCount = collectedUrls.size;
        const pageUrls = await this.collectEventUrlsFromPage(page, baseUrl);

        pageUrls.forEach(url => collectedUrls.add(url));

        console.log(`[ADNEC Scraper] Puppeteer sweep ${attempt + 1}: ${collectedUrls.size} URLs collected`);

        if (collectedUrls.size === beforeCount) {
          stagnantRounds += 1;
        } else {
          stagnantRounds = 0;
        }

        const loadMoreClicked = await page.evaluate(() => {
          const doc = (globalThis as any).document as any;
          const candidates = Array.from(doc?.querySelectorAll?.('button, a') ?? []);
          const loadMore = candidates.find(el => {
            const text = (el.textContent || '').toLowerCase();
            return text.includes('load more') || text.includes('more events') || text.includes('view more');
          });

          if (loadMore && (loadMore as any).click) {
            (loadMore as any).click();
            return true;
          }

          return false;
        });

        if (loadMoreClicked) {
          console.log('[ADNEC Scraper] Clicked load more button');
        }

        await page.evaluate(() => {
          const win = globalThis as any;
          const doc = win.document as any;
          const height = doc?.body?.scrollHeight ?? 0;
          if (typeof win.scrollTo === 'function') {
            win.scrollTo(0, height);
          }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!loadMoreClicked && stagnantRounds >= 2) {
          console.log('[ADNEC Scraper] No more content to load, stopping');
          break;
        }
      }

      console.log(`[ADNEC Scraper] Puppeteer collection complete: ${collectedUrls.size} URLs found`);
      return Array.from(collectedUrls);
    } catch (error) {
      console.error(`[ADNEC Scraper] Puppeteer failed for ${baseUrl}:`, error);
      return [];
    } finally {
      if (browser) {
        console.log('[ADNEC Scraper] Closing browser');
        await browser.close();
      }
    }
  }
  
  private async fetchWithRetry(url: string, retries = 3): Promise<string | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[ADNEC Scraper] Fetching: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.text();
      } catch (error) {
        console.error(`[ADNEC Scraper] Attempt ${attempt + 1} failed:`, error);
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // If regular fetch fails, try with Puppeteer as last resort
    return await this.fetchWithPuppeteer(url);
  }

  /**
   * Fetch a page using Puppeteer with stealth mode for bot-protected sites
   */
  private async fetchWithPuppeteer(url: string): Promise<string | null> {
    const executablePath =
      process.env.PUPPETEER_BROWSER_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;

    if (!executablePath) {
      console.log('[ADNEC Scraper] No browser path for Puppeteer fallback');
      return null;
    }

    console.log(`[ADNEC Scraper] Trying Puppeteer fetch for: ${url}`);
    let browser: Browser | null = null;

    try {
      browser = await puppeteerExtra.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
        ],
        executablePath,
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Wait a bit for any JS to finish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const html = await page.content();
      return html;
    } catch (error) {
      console.error(`[ADNEC Scraper] Puppeteer fetch failed for ${url}:`, error);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  /**
   * Extract event URLs from the listing page
   */
  private extractEventUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    
    // Find all links that contain '/eventlisting/' in the href
    $('a[href*="/eventlisting/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      
      // Skip if it's just the listing page itself
      if (href === '/en/eventlisting' || href === '/ar/eventlisting' || 
          href === '/eventlisting' || href === '/en/eventlisting/' || href === '/ar/eventlisting/') {
        return;
      }
      
      // Build full URL
      let fullUrl: string;
      if (href.startsWith('http')) {
        fullUrl = href;
      } else if (href.startsWith('/')) {
        fullUrl = `https://www.adnec.ae${href}`;
      } else {
        fullUrl = new URL(href, baseUrl).href;
      }
      
      // Only add if not seen and is an event detail page (has a slug after /eventlisting/)
      const hasSlug = fullUrl.match(/\/eventlisting\/[^\/\?]+/);
      if (!seen.has(fullUrl) && hasSlug && fullUrl !== baseUrl) {
        seen.add(fullUrl);
        urls.push(fullUrl);
      }
    });
    
    return urls;
  }
  
  /**
   * Parse date range from ADNEC format
   * Examples:
   * - "12 - 16 November 2025" -> { start: "2025-11-12", end: "2025-11-16" }
   * - "15 December 2025" -> { start: "2025-12-15", end: "2025-12-15" }
   */
  private parseDateRange(dateString: string): { start: string; end: string } {
    const cleanDate = dateString.trim();
    
    // Pattern for date range: "12 - 16 November 2025"
    const rangePattern = /(\d{1,2})\s*-\s*(\d{1,2})\s+(\w+)\s+(\d{4})/;
    const rangeMatch = cleanDate.match(rangePattern);
    
    if (rangeMatch) {
      const startDay = rangeMatch[1].padStart(2, '0');
      const endDay = rangeMatch[2].padStart(2, '0');
      const month = rangeMatch[3];
      const year = rangeMatch[4];
      
      // Convert month name to number
      const monthMap: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      
      const monthNum = monthMap[month.toLowerCase()] || '01';
      
      return {
        start: `${year}-${monthNum}-${startDay}`,
        end: `${year}-${monthNum}-${endDay}`
      };
    }
    
    // Try ISO format from JSON-LD (e.g., "2025-11-12T15:00")
    const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = cleanDate.match(isoPattern);
    
    if (isoMatch) {
      const isoDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      return { start: isoDate, end: isoDate };
    }
    
    // Fallback: try to parse single date "15 December 2025"
    const singlePattern = /(\d{1,2})\s+(\w+)\s+(\d{4})/;
    const singleMatch = cleanDate.match(singlePattern);
    
    if (singleMatch) {
      const day = singleMatch[1].padStart(2, '0');
      const month = singleMatch[2];
      const year = singleMatch[3];
      
      const monthMap: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      
      const monthNum = monthMap[month.toLowerCase()] || '01';
      const dateStr = `${year}-${monthNum}-${day}`;
      
      return { start: dateStr, end: dateStr };
    }
    
    // Fallback to current date if parsing fails
    const today = new Date().toISOString().split('T')[0];
    console.warn(`[ADNEC Scraper] Could not parse date: "${dateString}", using current date`);
    return { start: today, end: today };
  }
  
  /**
   * Format location to include ADNEC context
   * Examples:
   * - "Halls 1-3" -> "ADNEC (Halls 1-3)"
   * - "Hall 4" -> "ADNEC (Hall 4)"
   * - "ADNEC Centre Abu Dhabi" -> "ADNEC Centre Abu Dhabi"
   */
  private formatLocation(location: string): string {
    const cleanLocation = location.trim();
    
    // If it's just hall information, add ADNEC prefix
    if (/^Hall[s]?\s+[\d\-,\s]+$/i.test(cleanLocation)) {
      return `ADNEC (${cleanLocation})`;
    }
    
    // If it already mentions ADNEC, keep as is
    if (/adnec/i.test(cleanLocation)) {
      return cleanLocation;
    }
    
    // For any other hall mentions, add ADNEC
    if (/hall/i.test(cleanLocation)) {
      return `ADNEC (${cleanLocation})`;
    }
    
    // Default fallback
    return cleanLocation || 'ADNEC Centre Abu Dhabi';
  }
  
  /**
   * Extract event details from the event detail page
   */
  private async extractEventDetails(url: string): Promise<ScrapedEvent | null> {
    const html = await this.fetchWithRetry(url);
    
    if (!html) {
      console.warn(`[ADNEC Scraper] Could not fetch event page: ${url}`);
      return null;
    }
    
    const $ = cheerio.load(html);
    
    // Extract JSON-LD structured data
    let eventData: EventJsonLd | null = null;
    
    $('script[type="application/ld+json"]').each((_, element) => {
      const scriptContent = $(element).html();
      if (!scriptContent) return;
      
      try {
        const data = JSON.parse(scriptContent);
        if (data['@type'] === 'Event') {
          eventData = data as EventJsonLd;
          return false; // Break the loop
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    });
    
    if (!eventData) {
      console.warn(`[ADNEC Scraper] No structured event data found for: ${url}`);
      return null;
    }
    
    // TypeScript type assertion since we verified it's an Event type
    const event = eventData as EventJsonLd;
    
    // Extract location from page (looking for hall information)
    let location = 'ADNEC Centre Abu Dhabi';
    
    // Try to find location in various places
    const locationText = $('*:contains("Location:")').first().parent().text();
    if (locationText) {
      const lines = locationText.split('\n').map(l => l.trim()).filter(l => l);
      const locationIndex = lines.findIndex(l => l.includes('Location:'));
      if (locationIndex >= 0 && locationIndex + 1 < lines.length) {
        const hallInfo = lines[locationIndex + 1];
        if (hallInfo && !hallInfo.includes(':')) {
          location = this.formatLocation(hallInfo);
        }
      }
    }
    
    // If not found, try from JSON-LD location
    if (location === 'ADNEC Centre Abu Dhabi' && event.location) {
      const locName = event.location.name || '';
      if (locName) {
        location = this.formatLocation(locName);
      }
    }
    
    // Parse dates
    const dates = this.parseDateRange(event.startDate);
    if (event.endDate) {
      const endDates = this.parseDateRange(event.endDate);
      dates.end = endDates.end;
    }
    
    // Extract organizer
    let organizer = 'ADNEC';
    if (event.organizer && event.organizer.name) {
      organizer = event.organizer.name;
    }
    
    // Extract description
    const description = event.description || event.name || '';
    
    // Create external ID from URL
    const urlParts = url.split('/eventlisting/');
    const externalId = urlParts.length > 1 ? `adnec-${urlParts[1]}` : `adnec-${Date.now()}`;
    
    return {
      name: event.name,
      url,
      startDate: dates.start,
      endDate: dates.end,
      location,
      organizers: organizer,
      category: 'Exhibitions & Conferences',
      description,
      externalId,
    };
  }
  
  /**
   * Try to extract event URLs from sitemap
   */
  private async extractUrlsFromSitemap(): Promise<string[]> {
    console.log('[ADNEC Scraper] Attempting to fetch URLs from sitemap...');
    
    try {
      const sitemapHtml = await this.fetchWithRetry(this.sitemapUrl, 2);
      if (!sitemapHtml) {
        console.log('[ADNEC Scraper] Sitemap not accessible');
        return [];
      }
      
      const $ = cheerio.load(sitemapHtml, { xmlMode: true });
      const urls: string[] = [];
      
      // Extract all <loc> tags containing /eventlisting/
      $('loc').each((_, element) => {
        const url = $(element).text().trim();
        if (url.includes('/eventlisting/') && !url.endsWith('/eventlisting')) {
          urls.push(url);
        }
      });
      
      console.log(`[ADNEC Scraper] Found ${urls.length} event URLs in sitemap`);
      return urls;
    } catch (error) {
      console.log('[ADNEC Scraper] Error fetching sitemap:', error);
      return [];
    }
  }

  /**
   * Attempt to fetch more events by simulating pagination/load more
   */
  private async fetchWithPagination(baseUrl: string, maxAttempts: number = 5): Promise<string[]> {
    const allUrls = new Set<string>();
    let previousCount = 0;
    
    for (let page = 1; page <= maxAttempts; page++) {
      console.log(`[ADNEC Scraper] Attempting to fetch page ${page}...`);
      
      // Try different pagination patterns that Livewire might use
      const paginationUrls = [
        baseUrl,
        `${baseUrl}?page=${page}`,
        `${baseUrl}?offset=${(page - 1) * 12}`, // Common offset pattern
      ];
      
      for (const url of paginationUrls) {
        const html = await this.fetchWithRetry(url, 2);
        if (!html) continue;
        
        const $ = cheerio.load(html);
        const urls = this.extractEventUrls($, baseUrl);
        
        urls.forEach(u => allUrls.add(u));
      }
      
      // Check if we found new events
      const currentCount = allUrls.size;
      if (currentCount === previousCount && page > 1) {
        // No new events found, stop trying
        console.log(`[ADNEC Scraper] No new events found on page ${page}, stopping pagination`);
        break;
      }
      
      console.log(`[ADNEC Scraper] Page ${page}: Found ${currentCount} total events (${currentCount - previousCount} new)`);
      previousCount = currentCount;
      
      // Small delay between pagination attempts
      if (page < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return Array.from(allUrls);
  }

  /**
   * Fetch events from the listing page and extract details
   */
  async fetchEvents(): Promise<ScrapedEvent[]> {
    console.log('[ADNEC Scraper] Starting ADNEC events sync...');
    
    // Fetch English listing with pagination
    console.log('[ADNEC Scraper] Fetching English event listings (with pagination attempts)...');
    let enUrls = await this.fetchListingUrlsWithPuppeteer(this.baseUrlEn);

    if (enUrls.length === 0) {
      console.log('[ADNEC Scraper] Puppeteer listing failed, falling back to HTML pagination...');
      enUrls = await this.fetchWithPagination(this.baseUrlEn);
    }
    
    if (enUrls.length === 0) {
      console.error('[ADNEC Scraper] Failed to fetch English listings');
      return [];
    }
    
    console.log(`[ADNEC Scraper] Found ${enUrls.length} events in English listing`);
    
    // Fetch Arabic listing for URL mapping with pagination
    console.log('[ADNEC Scraper] Fetching Arabic event listings (with pagination attempts)...');
    let arUrls = await this.fetchListingUrlsWithPuppeteer(this.baseUrlAr);

    if (arUrls.length === 0) {
      console.log('[ADNEC Scraper] Puppeteer listing failed, falling back to HTML pagination...');
      arUrls = await this.fetchWithPagination(this.baseUrlAr);
    }
    
    const urlMapping = new Map<string, string>(); // EN URL -> AR URL
    
    console.log(`[ADNEC Scraper] Found ${arUrls.length} events in Arabic listing`);
    
    // Create mapping based on event slug
    for (const arUrl of arUrls) {
      const slug = arUrl.split('/eventlisting/')[1] || '';
      if (slug) {
        const enEquivalent = `https://www.adnec.ae/en/eventlisting/${slug}`;
        urlMapping.set(enEquivalent, arUrl);
      }
    }
    
    // Fetch details for each event
    const events: ScrapedEvent[] = [];
    console.log(`[ADNEC Scraper] Fetching details for ${enUrls.length} events...`);
    
    for (let i = 0; i < enUrls.length; i++) {
      const enUrl = enUrls[i];
      console.log(`[ADNEC Scraper] [${i + 1}/${enUrls.length}] Processing: ${enUrl}`);
      
      // Fetch English details
      const enEvent = await this.extractEventDetails(enUrl);
      
      if (!enEvent) {
        console.warn(`[ADNEC Scraper] Skipping event (no data): ${enUrl}`);
        continue;
      }
      
      // Fetch Arabic details
      const arUrl = urlMapping.get(enUrl);
      if (arUrl) {
        console.log(`[ADNEC Scraper] Fetching Arabic version: ${arUrl}`);
        const arEvent = await this.extractEventDetails(arUrl);
        
        if (arEvent) {
          enEvent.nameAr = arEvent.name;
          enEvent.descriptionAr = arEvent.description;
          enEvent.locationAr = arEvent.location;
          enEvent.organizersAr = arEvent.organizers;
          enEvent.categoryAr = 'المعارض والمؤتمرات'; // Arabic for "Exhibitions & Conferences"
          
          console.log(`[ADNEC Scraper] ✓ Fetched Arabic data for: ${enEvent.name}`);
        }
      }
      
      events.push(enEvent);
      console.log(`[ADNEC Scraper] ✓ ${enEvent.name}`);
      console.log(`[ADNEC Scraper]   📅 ${enEvent.startDate} to ${enEvent.endDate}`);
      console.log(`[ADNEC Scraper]   📍 ${enEvent.location}`);
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`[ADNEC Scraper] Successfully fetched ${events.length} events`);
    
    return events;
  }
}
