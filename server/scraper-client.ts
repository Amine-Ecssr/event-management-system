import crypto from 'node:crypto';
import type { ScrapedEvent, ScraperAllPayload, ScraperSourcePayload } from '@shared/scraper-types';

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
const DEFAULT_SCRAPER_TOKEN = 'change-this-scraper-token';
const DEFAULT_SCRAPER_SECRET = 'change-this-scraper-secret';
const SCRAPER_SERVICE_TOKEN = process.env.SCRAPER_SERVICE_TOKEN || DEFAULT_SCRAPER_TOKEN;
const SCRAPER_SERVICE_SECRET = process.env.SCRAPER_SERVICE_SECRET || process.env.SCRAPER_SERVICE_TOKEN || DEFAULT_SCRAPER_SECRET;

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
};

class ScraperServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = SCRAPER_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  private sign(body: string): string {
    if (!SCRAPER_SERVICE_SECRET) {
      throw new Error('SCRAPER_SERVICE_SECRET is not configured. Cannot verify scraper responses.');
    }

    return crypto.createHmac('sha256', SCRAPER_SERVICE_SECRET).update(body).digest('hex');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(SCRAPER_SERVICE_TOKEN ? { 'x-scraper-auth': SCRAPER_SERVICE_TOKEN } : {}),
        ...options.headers,
      },
    });

    const rawBody = await response.text();
    const signature = response.headers.get('x-scraper-signature');

    if (!signature) {
      throw new Error('Missing scraper response signature');
    }

    const expected = this.sign(rawBody);
    if (!timingSafeEqual(signature, expected)) {
      throw new Error('Invalid scraper response signature');
    }

    if (!response.ok) {
      throw new Error(`Scraper service responded with ${response.status}: ${rawBody}`);
    }

    return JSON.parse(rawBody) as T;
  }

  async fetchAbuDhabiEvents(options: { startFromJanuary?: boolean } = {}): Promise<ScrapedEvent[]> {
    const payload: ScraperSourcePayload = await this.request('/api/scraper/abu-dhabi', {
      method: 'POST',
      body: JSON.stringify({ startFromJanuary: options.startFromJanuary ?? false }),
    });

    return payload.events;
  }

  async fetchAdnecEvents(): Promise<ScrapedEvent[]> {
    const payload: ScraperSourcePayload = await this.request('/api/scraper/adnec', { method: 'POST' });
    return payload.events;
  }

  async fetchAllEvents(options: { startFromJanuary?: boolean } = {}): Promise<ScraperAllPayload> {
    return this.request('/api/scraper/all', {
      method: 'POST',
      body: JSON.stringify({ startFromJanuary: options.startFromJanuary ?? false }),
    });
  }
}

export const scraperClient = new ScraperServiceClient();
