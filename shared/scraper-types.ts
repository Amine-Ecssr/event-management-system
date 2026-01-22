export interface ScrapedEvent {
  name: string;
  nameAr?: string;
  url: string;
  startDate: string;
  endDate: string;
  location: string;
  locationAr?: string;
  organizers: string;
  organizersAr?: string;
  category: string;
  categoryAr?: string;
  description: string;
  descriptionAr?: string;
  externalId: string;
  sectorId?: string;
}

export interface ScraperSourcePayload {
  source: string;
  generatedAt: string;
  events: ScrapedEvent[];
}

export interface ScraperAllPayload {
  generatedAt: string;
  sources: Record<string, ScrapedEvent[]>;
}
