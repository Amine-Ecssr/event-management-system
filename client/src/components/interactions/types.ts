// Shared types for interactions (leads and partnerships)

// Attachment type
export interface InteractionAttachment {
  id: number;
  leadInteractionId?: number | null;
  partnershipInteractionId?: number | null;
  objectKey: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedByUserId?: number | null;
  uploadedAt?: string;
  downloadUrl?: string;
}

export interface BaseInteraction {
  id: number;
  type: string;
  description: string;
  descriptionAr?: string | null;
  outcome: string | null;
  outcomeAr?: string | null;
  interactionDate?: string;
  createdAt: string;
  createdByUserId?: number | null;
  createdByUsername?: string | null;
  attachments?: InteractionAttachment[];
}

export interface LeadInteraction extends BaseInteraction {
  leadId: number;
}

export interface PartnershipInteraction extends BaseInteraction {
  organizationId: number;
}

// Union type for polymorphic components
export type Interaction = LeadInteraction | PartnershipInteraction;

// Entity type discriminator
export type EntityType = 'lead' | 'partnership';

// Interaction types for leads (basic set)
export const LEAD_INTERACTION_TYPES = ['email', 'phone_call', 'meeting', 'other'] as const;
export type LeadInteractionType = (typeof LEAD_INTERACTION_TYPES)[number];

// Interaction types for partnerships (extended set)
export const PARTNERSHIP_INTERACTION_TYPES = [
  'email', 
  'phone_call', 
  'meeting', 
  'document_sent', 
  'proposal_submitted', 
  'review_session', 
  'other'
] as const;
export type PartnershipInteractionType = (typeof PARTNERSHIP_INTERACTION_TYPES)[number];

// All interaction types combined (using Array.from for compatibility)
export const ALL_INTERACTION_TYPES = Array.from(
  new Set([...LEAD_INTERACTION_TYPES, ...PARTNERSHIP_INTERACTION_TYPES])
) as readonly string[];

// Type colors for styling
export const INTERACTION_TYPE_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  phone_call: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  meeting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  document_sent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  proposal_submitted: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  review_session: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export const INTERACTION_ICON_BG: Record<string, string> = {
  email: 'bg-blue-500',
  phone_call: 'bg-green-500',
  meeting: 'bg-purple-500',
  document_sent: 'bg-orange-500',
  proposal_submitted: 'bg-cyan-500',
  review_session: 'bg-yellow-500',
  other: 'bg-gray-500',
};

// Helper to get interaction types based on entity
export function getInteractionTypes(entityType: EntityType): readonly string[] {
  return entityType === 'lead' ? LEAD_INTERACTION_TYPES : PARTNERSHIP_INTERACTION_TYPES;
}

// Helper to get translation key prefix based on entity
export function getTranslationPrefix(entityType: EntityType): string {
  return entityType === 'lead' ? 'leads' : 'partnerships';
}

// Allowed file types for interaction attachments
export const INTERACTION_ALLOWED_FILE_TYPES = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip', '.txt', '.csv'
];

// Max file size for interaction attachments (10MB)
export const INTERACTION_MAX_FILE_SIZE = 10 * 1024 * 1024;

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Helper to get file icon type based on MIME type
export function getFileIconType(mimeType: string): 'document' | 'image' | 'spreadsheet' | 'presentation' | 'archive' | 'text' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('zip')) return 'archive';
  return 'text';
}
