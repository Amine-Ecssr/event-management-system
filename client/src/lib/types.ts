export interface Event {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  locationAr?: string;
  organizers?: string;
  organizersAr?: string;
  url?: string;
  category?: string; // Keep for backward compatibility
  categoryAr?: string; // Keep for backward compatibility  
  categoryId?: number; // New FK to categories table
  eventType: 'local' | 'international';
  eventScope: 'internal' | 'external';
  expectedAttendance?: number; // Hidden field for admins, sent to WhatsApp
  reminder1Week?: boolean;
  reminder1Day?: boolean;
  reminderWeekly?: boolean;
  reminderDaily?: boolean;
  reminderMorningOf?: boolean;
  source?: string; // Source of the event (e.g., 'manual', 'abu_dhabi_media', etc.)
  sourceUrl?: string; // Original URL if scraped
  isScraped?: boolean; // Indicates if event was scraped from external source
  agendaEnFileName?: string;
  agendaArFileName?: string;
  // Archive fields
  isArchived?: boolean; // Indicates if event has been archived (الحصاد)
  archivedAt?: string; // When the event was archived
  // Media
  media?: EventMedia[]; // Event images/photos
  thumbnailUrl?: string | null; // Signed URL for first thumbnail (for card display)
}

export interface EventMedia {
  id: number;
  eventId: string;
  objectKey: string;
  thumbnailKey?: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  captionAr?: string | null;
  displayOrder: number;
  uploadedByUserId?: number | null;
  uploadedAt?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface ArchivedEvent {
  id: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  locationAr?: string | null;
  organizers?: string | null;
  organizersAr?: string | null;
  url?: string | null;
  category?: string | null;
  categoryAr?: string | null;
  categoryId?: number | null;
  eventType: string;
  eventScope: string;
  originalEventId?: string | null;
  actualAttendees?: number | null;
  highlights?: string | null;
  highlightsAr?: string | null;
  impact?: string | null;
  impactAr?: string | null;
  keyTakeaways?: string | null;
  keyTakeawaysAr?: string | null;
  photoKeys?: string[] | null;
  thumbnailKeys?: string[] | null;
  thumbnailUrl?: string | null; // Signed URL for first thumbnail (for card display)
  youtubeVideoIds?: string[] | null;
  archivedByUserId?: number | null;
  createdDirectly: boolean;
  createdAt?: string;
  updatedAt?: string;
  media?: ArchiveMedia[];
  speakers?: ArchivedEventSpeaker[];
}

export interface ArchiveMedia {
  id: number;
  archivedEventId: number;
  objectKey: string;
  thumbnailKey?: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  captionAr?: string | null;
  displayOrder: number;
  uploadedByUserId?: number | null;
  uploadedAt?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface ArchiveStats {
  totalEvents: number;
  totalAttendees: number;
  yearsActive: number[];
  categoriesUsed: number;
  eventsWithPhotos: number;
  eventsWithVideos: number;
}

export interface Category {
  id: number;
  nameEn: string;
  nameAr?: string;
  createdAt?: string;
}

// Contacts & Speakers types
export interface Organization {
  id: number;
  nameEn: string;
  nameAr?: string | null;
  countryId?: number | null;
  country?: Country;
  website?: string | null;
  createdAt?: string;
}

export interface Position {
  id: number;
  nameEn: string;
  nameAr?: string | null;
  createdAt?: string;
}

export interface PartnershipType {
  id: number;
  nameEn: string;
  nameAr?: string | null;
  createdAt?: string;
}

export interface AgreementType {
  id: number;
  nameEn: string;
  nameAr?: string | null;
  createdAt?: string;
}

export interface Country {
  id: number;
  code: string;
  nameEn: string;
  nameAr?: string | null;
}

export interface Contact {
  id: number;
  nameEn: string;
  nameAr?: string | null;
  title?: string | null;
  titleAr?: string | null;
  organizationId?: number | null;
  positionId?: number | null;
  countryId?: number | null;
  phone?: string | null;
  email?: string | null;
  profilePictureKey?: string | null;
  profilePictureThumbnailKey?: string | null;
  isEligibleSpeaker: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Joined relations
  organization?: Organization;
  position?: Position;
  country?: Country;
}

export interface EventSpeaker {
  id: number;
  eventId: string;
  contactId: number;
  role?: string | null;
  roleAr?: string | null;
  displayOrder: number;
  createdAt?: string;
  contact: Contact;
}

export interface ArchivedEventSpeaker {
  id: number;
  archivedEventId: number;
  contactId?: number | null;
  role?: string | null;
  roleAr?: string | null;
  displayOrder: number;
  speakerNameEn?: string | null;
  speakerNameAr?: string | null;
  speakerTitle?: string | null;
  speakerTitleAr?: string | null;
  speakerPosition?: string | null;
  speakerPositionAr?: string | null;
  speakerOrganization?: string | null;
  speakerOrganizationAr?: string | null;
  speakerProfilePictureKey?: string | null;
  speakerProfilePictureThumbnailKey?: string | null;
  createdAt?: string;
}

export type ViewMode = 'calendar' | 'list';

export type CalendarViewMode = 'monthly' | 'quarterly' | 'bi-annually' | 'yearly';

export interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  totalTasks?: number;
  pendingTasks?: number;
  completedTasks?: number;
  totalStakeholders?: number;
  eventsByCategory: Record<string, number>;
}

