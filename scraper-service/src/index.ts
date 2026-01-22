import cors from 'cors';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { AbuDhabiEventsScraper } from './sources/abuDhabiEvents.js';
import { AdnecEventsScraper } from './sources/adnecEvents.js';
import type { ScraperAllPayload, ScraperSourcePayload, ScrapedEvent } from '@shared/scraper-types';

const LOG_PREFIX = '[Scraper Service]';
const PORT = process.env.PORT || 3002;
const DEFAULT_TOKEN = 'change-this-scraper-token';
const DEFAULT_SECRET = 'change-this-scraper-secret';
const AUTH_TOKEN = process.env.SCRAPER_SERVICE_TOKEN || DEFAULT_TOKEN;
const SIGNING_SECRET = process.env.SCRAPER_SERVICE_SECRET || process.env.SCRAPER_SERVICE_TOKEN || DEFAULT_SECRET;

if (!AUTH_TOKEN) {
  console.warn(`${LOG_PREFIX} WARNING: SCRAPER_SERVICE_TOKEN is not set. Requests will not be authenticated.`);
}

if (!SIGNING_SECRET) {
  console.warn(`${LOG_PREFIX} WARNING: SCRAPER_SERVICE_SECRET is not set. Responses will not be signed.`);
}

const app = express();
app.use(cors());
app.use(express.json());

const abuDhabiScraper = new AbuDhabiEventsScraper();
const adnecScraper = new AdnecEventsScraper();

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!AUTH_TOKEN) return next();

  const token = req.header('x-scraper-auth');
  if (token !== AUTH_TOKEN) {
    console.warn(`${LOG_PREFIX} Unauthorized request to ${req.path}`);
    return res.status(401).json({ error: 'Unauthorized scraper request' });
  }

  return next();
};

const signPayload = (payload: string): string | undefined => {
  if (!SIGNING_SECRET) return undefined;

  return crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
};

const respondWithSignature = (res: Response, status: number, body: unknown) => {
  const payload = JSON.stringify(body);
  const signature = signPayload(payload);

  if (signature) {
    res.setHeader('x-scraper-signature', signature);
  }

  res.status(status).type('application/json').send(payload);
};

const mapResponse = (source: string, events: ScrapedEvent[]): ScraperSourcePayload => ({
  source,
  generatedAt: new Date().toISOString(),
  events,
});

app.get('/health', (_req, res) => {
  respondWithSignature(res, 200, {
    status: 'ok',
    service: 'scraper-service',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/scraper/abu-dhabi', authenticate, async (req, res) => {
  try {
    const { startFromJanuary = false } = req.body ?? {};
    const events = await abuDhabiScraper.fetchCurrentAndNextYear(Boolean(startFromJanuary));

    respondWithSignature(res, 200, mapResponse('abu-dhabi-media-office', events));
  } catch (error) {
    console.error(`${LOG_PREFIX} Abu Dhabi scrape failed`, error);
    respondWithSignature(res, 500, {
      error: 'Failed to scrape Abu Dhabi events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/scraper/adnec', authenticate, async (_req, res) => {
  try {
    const events = await adnecScraper.fetchEvents();
    respondWithSignature(res, 200, mapResponse('adnec', events));
  } catch (error) {
    console.error(`${LOG_PREFIX} ADNEC scrape failed`, error);
    respondWithSignature(res, 500, {
      error: 'Failed to scrape ADNEC events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/scraper/all', authenticate, async (req, res) => {
  try {
    const { startFromJanuary = false } = req.body ?? {};
    const [abuDhabiEvents, adnecEvents] = await Promise.all([
      abuDhabiScraper.fetchCurrentAndNextYear(Boolean(startFromJanuary)),
      adnecScraper.fetchEvents(),
    ]);

    const payload: ScraperAllPayload = {
      generatedAt: new Date().toISOString(),
      sources: {
        'abu-dhabi-media-office': abuDhabiEvents,
        adnec: adnecEvents,
      },
    };

    respondWithSignature(res, 200, payload);
  } catch (error) {
    console.error(`${LOG_PREFIX} Combined scrape failed`, error);
    respondWithSignature(res, 500, {
      error: 'Failed to scrape events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`${LOG_PREFIX} Listening on port ${PORT}`);
});
