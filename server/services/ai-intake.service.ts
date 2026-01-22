/**
 * AI Intake Service
 *
 * Heuristics for extracting structured data from pasted text.
 *
 * @module services/ai-intake
 */

import { llm } from './llm-provider';

export type AiIntakeType = 'event' | 'task' | 'partnership' | 'lead' | 'unknown';

export type AiIntakeResult = {
  type: AiIntakeType;
  confidence: number;
  summary: string;
  fields: Record<string, string | null>;
  missingFields: string[];
  suggestions: string[];
};

const TYPE_KEYWORDS: Record<AiIntakeType, string[]> = {
  event: ['event', 'conference', 'summit', 'workshop', 'seminar', 'webinar', 'meetup', 'launch'],
  task: ['task', 'todo', 'to-do', 'deadline', 'due', 'follow up', 'action item'],
  partnership: ['partner', 'partnership', 'collaboration', 'agreement', 'mou', 'sponsor', 'alliance'],
  lead: ['lead', 'prospect', 'contact', 'client', 'vendor', 'customer'],
  unknown: [],
};

const DATE_PATTERNS = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
  /\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/,
  /\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b/,
];

function getFirstSentence(text: string): string {
  const sentence = text.split(/[.!?\n]/).find(Boolean) || text;
  return sentence.trim().slice(0, 140);
}

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function extractOrganization(text: string): string | null {
  const withMatch = text.match(/(?:with|between|partnering with)\s+([A-Z][\w&.\- ]{2,})/i);
  if (withMatch?.[1]) {
    return withMatch[1].trim();
  }
  return null;
}

function extractContactName(text: string): string | null {
  const contactMatch = text.match(/(?:contact|lead|prospect|client)\s*:\s*([A-Z][\w\s.'-]+)/i);
  if (contactMatch?.[1]) {
    return contactMatch[1].trim();
  }
  return null;
}

/**
 * Sanitize user input to prevent prompt injection attacks
 * Escapes special characters and limits length
 */
function sanitizeUserInput(text: string): string {
  // Limit length to prevent token abuse
  const maxLength = 5000;
  let sanitized = text.slice(0, maxLength);

  // Escape characters that could be used for prompt injection
  sanitized = sanitized
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    // Remove potential instruction override patterns
    .replace(/\b(ignore|disregard|forget)\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/gi, '[filtered]')
    .replace(/\b(system|assistant|user)\s*:/gi, '[role]:')
    // Trim excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized;
}

function scoreType(text: string): { type: AiIntakeType; confidence: number } {
  const lower = text.toLowerCase();
  const scores: Record<AiIntakeType, number> = {
    event: 0,
    task: 0,
    partnership: 0,
    lead: 0,
    unknown: 0,
  };

  (Object.keys(TYPE_KEYWORDS) as AiIntakeType[]).forEach((type) => {
    TYPE_KEYWORDS[type].forEach((keyword) => {
      if (lower.includes(keyword)) {
        scores[type] += 1;
      }
    });
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = sorted[0] as [AiIntakeType, number];
  const totalScore = Object.values(scores).reduce((sum, val) => sum + val, 0);

  if (topScore === 0) {
    return { type: 'unknown', confidence: 0.2 };
  }

  const confidence = Math.min(0.95, 0.4 + topScore / Math.max(totalScore, 1));
  return { type: topType, confidence };
}

export interface DropdownOptions {
  departments?: Array<{ id: number; name: string; nameAr: string | null }>;
  partnershipTypes?: Array<{ id: number; nameEn: string; nameAr: string | null }>;
  eventTypes?: Array<{ value: string; label: string }>;
  priorities?: Array<{ value: string; label: string }>;
}

/**
 * Enhanced intake parsing with LLM support for translation and dropdown-aware extraction
 */
async function parseWithLLM(
  text: string,
  type: AiIntakeType,
  options?: DropdownOptions
): Promise<Record<string, string | null>> {
  if (!llm.isAvailable()) {
    // Fallback to basic extraction
    return {
      title: getFirstSentence(text),
      description: text.slice(0, 800),
      date: extractDate(text),
      location: null,
      organizationName: extractOrganization(text),
      contactName: extractContactName(text),
    };
  }

  // Sanitize user input to prevent prompt injection
  const sanitizedText = sanitizeUserInput(text);

  try {
    let prompt = '';

    // Type-specific prompts with dropdown options
    if (type === 'event') {
      const eventTypeOptions = options?.eventTypes?.map(et => et.value).join(', ') || 'local, international';
      const departmentsList = options?.departments?.map(d => `${d.name} (ID: ${d.id})`).join(', ') || '';

      prompt = `You are analyzing user input for creating an event. Extract structured data and provide both English and Arabic translations.

CRITICAL RULES:
1. title must be a SHORT, CONCISE event name (5-10 words max), NOT the full description
2. description should contain additional details from the input
3. Extract dates in YYYY-MM-DD format, times in HH:MM 24-hour format
4. For eventType, choose the most appropriate from: ${eventTypeOptions}

User input: "${sanitizedText}"

## EXAMPLES

Example 1:
Input: "Annual Innovation Summit 2025 at ADNEC Exhibition Center on March 15th from 9am to 5pm. Expected 500+ attendees from government and private sectors. Organized by ECSSR and Ministry of Economy."
Output: {
  "title": "Annual Innovation Summit 2025",
  "titleAr": "قمة الابتكار السنوية 2025",
  "description": "Expected 500+ attendees from government and private sectors. Organized by ECSSR and Ministry of Economy.",
  "descriptionAr": "من المتوقع حضور أكثر من 500 شخص من القطاعين الحكومي والخاص. تنظيم مركز الإمارات للدراسات والبحوث الاستراتيجية ووزارة الاقتصاد.",
  "date": "2025-03-15",
  "startTime": "09:00",
  "endTime": "17:00",
  "location": "ADNEC Exhibition Center",
  "locationAr": "مركز أدنيك للمعارض",
  "organizers": "ECSSR, Ministry of Economy",
  "organizersAr": "مركز الإمارات للدراسات والبحوث الاستراتيجية، وزارة الاقتصاد",
  "eventType": "international",
  "expectedAttendees": "500"
}

Example 2:
Input: "ندوة حول التحول الرقمي في القطاع الحكومي يوم الأربعاء القادم الساعة 2 ظهراً في قاعة الشيخ زايد"
Output: {
  "title": "Digital Transformation in Government Sector Seminar",
  "titleAr": "ندوة التحول الرقمي في القطاع الحكومي",
  "description": "Seminar focused on digital transformation in the government sector",
  "descriptionAr": "ندوة تركز على التحول الرقمي في القطاع الحكومي",
  "date": null,
  "startTime": "14:00",
  "endTime": null,
  "location": "Sheikh Zayed Hall",
  "locationAr": "قاعة الشيخ زايد",
  "organizers": null,
  "organizersAr": null,
  "eventType": "local",
  "expectedAttendees": null
}

Example 3:
Input: "Quick team meeting tomorrow at 10am in Conference Room B to discuss Q1 results"
Output: {
  "title": "Q1 Results Discussion Meeting",
  "titleAr": "اجتماع مناقشة نتائج الربع الأول",
  "description": "Quick team meeting to discuss Q1 results",
  "descriptionAr": "اجتماع فريق سريع لمناقشة نتائج الربع الأول",
  "date": null,
  "startTime": "10:00",
  "endTime": null,
  "location": "Conference Room B",
  "locationAr": "غرفة الاجتماعات ب",
  "organizers": null,
  "organizersAr": null,
  "eventType": "local",
  "expectedAttendees": null
}

Now extract from the user input above. Return ONLY valid JSON with these exact fields:
- title: Event title in English (concise, 5-10 words)
- titleAr: Arabic translation of the title
- description: Description in English
- descriptionAr: Arabic translation of the description
- date: Start date in YYYY-MM-DD format
- startTime: Start time in HH:MM format (24-hour)
- endTime: End time in HH:MM format (24-hour)
- location: Location in English
- locationAr: Arabic translation of location
- organizers: Organizers in English
- organizersAr: Arabic translation of organizers
- eventType: Must be one of: ${eventTypeOptions}
- expectedAttendees: Number of expected attendees (just the number)
${departmentsList ? `- relevantDepartments: Array of department IDs that should be involved. Available: ${departmentsList}` : ''}

Return valid JSON only, no explanations.`;
    }
    else if (type === 'task') {
      const priorities = options?.priorities?.map(p => p.value).join(', ') || 'high, medium, low';
      const departmentsList = options?.departments?.map(d => `${d.name} (ID: ${d.id})`).join(', ') || '';

      prompt = `You are analyzing user input for creating a task. Extract structured data and provide both English and Arabic translations.

CRITICAL RULES:
1. title must be a SHORT, ACTIONABLE task name (3-8 words), NOT the full description
2. title should start with a verb (e.g., "Prepare...", "Send...", "Review...", "Contact...")
3. description should contain additional context and details
4. For priority, infer from urgency words (urgent/ASAP = high, soon = medium, when possible = low)

User input: "${sanitizedText}"

## EXAMPLES

Example 1:
Input: "Need to finalize the keynote speaker contract for the innovation summit ASAP. The event is on March 15th and we need everything signed by end of February. Contact legal department for review."
Output: {
  "title": "Finalize Keynote Speaker Contract",
  "titleAr": "إنهاء عقد المتحدث الرئيسي",
  "description": "Finalize contract for innovation summit keynote speaker. Event on March 15th, signatures needed by end of February. Requires legal department review.",
  "descriptionAr": "إنهاء عقد المتحدث الرئيسي لقمة الابتكار. الحدث في 15 مارس، يجب الحصول على التوقيعات بحلول نهاية فبراير. يتطلب مراجعة الإدارة القانونية.",
  "dueDate": "2025-02-28",
  "priority": "high"
}

Example 2:
Input: "إرسال دعوات الحضور للمؤتمر السنوي قبل نهاية الأسبوع"
Output: {
  "title": "Send Conference Attendance Invitations",
  "titleAr": "إرسال دعوات حضور المؤتمر",
  "description": "Send attendance invitations for the annual conference before end of the week",
  "descriptionAr": "إرسال دعوات الحضور للمؤتمر السنوي قبل نهاية الأسبوع",
  "dueDate": null,
  "priority": "medium"
}

Example 3:
Input: "When you get a chance, update the event calendar with the new workshop dates from the planning meeting notes"
Output: {
  "title": "Update Calendar with Workshop Dates",
  "titleAr": "تحديث التقويم بتواريخ ورش العمل",
  "description": "Update the event calendar with new workshop dates from planning meeting notes",
  "descriptionAr": "تحديث تقويم الفعاليات بتواريخ ورش العمل الجديدة من ملاحظات اجتماع التخطيط",
  "dueDate": null,
  "priority": "low"
}

Now extract from the user input above. Return ONLY valid JSON with these exact fields:
- title: Task title in English (concise, starts with verb, 3-8 words)
- titleAr: Arabic translation of the title
- description: Description in English
- descriptionAr: Arabic translation of the description
- dueDate: Due date in YYYY-MM-DD format
- priority: Must be one of: ${priorities}
${departmentsList ? `- departmentId: Department ID responsible. Available: ${departmentsList}` : ''}

Return valid JSON only, no explanations.`;
    }
    else if (type === 'partnership') {
      const partnershipTypesList = options?.partnershipTypes?.map(pt => `${pt.nameEn} (ID: ${pt.id})`).join(', ') || '';

      prompt = `You are analyzing user input for creating a partnership record. Extract structured data and provide both English and Arabic translations.

CRITICAL RULES:
1. organizationName must be ONLY the company/institution name, NOT a description
2. description should explain the partnership scope and objectives
3. contactName must be ONLY the person's name (first + last), NOT their title or role
4. Extract email and phone only if they look like valid formats

User input: "${sanitizedText}"

## EXAMPLES

Example 1:
Input: "New partnership with Abu Dhabi University for research collaboration starting January 2025. Contact: Dr. Ahmed Hassan, ahmed.hassan@adu.ac.ae, +971 2 501 5555. Website: www.adu.ac.ae"
Output: {
  "organizationName": "Abu Dhabi University",
  "organizationNameAr": "جامعة أبوظبي",
  "description": "Research collaboration partnership with Abu Dhabi University",
  "descriptionAr": "شراكة تعاون بحثي مع جامعة أبوظبي",
  "startDate": "2025-01-01",
  "endDate": null,
  "website": "www.adu.ac.ae",
  "contactName": "Ahmed Hassan",
  "contactEmail": "ahmed.hassan@adu.ac.ae",
  "contactPhone": "+971 2 501 5555"
}

Example 2:
Input: "توقيع مذكرة تفاهم مع مؤسسة محمد بن راشد للمعرفة لتبادل الخبرات في مجال نشر المعرفة والتعليم. مدة الشراكة 3 سنوات"
Output: {
  "organizationName": "Mohammed Bin Rashid Knowledge Foundation",
  "organizationNameAr": "مؤسسة محمد بن راشد للمعرفة",
  "description": "MOU for knowledge exchange in knowledge dissemination and education. Partnership duration: 3 years.",
  "descriptionAr": "مذكرة تفاهم لتبادل الخبرات في مجال نشر المعرفة والتعليم. مدة الشراكة 3 سنوات",
  "startDate": null,
  "endDate": null,
  "website": null,
  "contactName": null,
  "contactEmail": null,
  "contactPhone": null
}

Example 3:
Input: "Renewed our sponsorship agreement with Emirates NBD Bank for the annual conference series. Agreement covers 2025-2027. Primary contact is Fatima Al-Ali from their CSR department."
Output: {
  "organizationName": "Emirates NBD Bank",
  "organizationNameAr": "بنك الإمارات دبي الوطني",
  "description": "Sponsorship agreement for annual conference series covering 2025-2027",
  "descriptionAr": "اتفاقية رعاية لسلسلة المؤتمرات السنوية للفترة 2025-2027",
  "startDate": "2025-01-01",
  "endDate": "2027-12-31",
  "website": null,
  "contactName": "Fatima Al-Ali",
  "contactEmail": null,
  "contactPhone": null
}

Now extract from the user input above. Return ONLY valid JSON with these exact fields:
- organizationName: Organization name in English (company/institution name only)
- organizationNameAr: Arabic translation
- description: Partnership description in English
- descriptionAr: Arabic translation of description
- startDate: Partnership start date in YYYY-MM-DD format
- endDate: Partnership end date in YYYY-MM-DD format
- website: Organization website URL
- contactName: Primary contact person name (just the name)
- contactEmail: Contact email address
- contactPhone: Contact phone number
${partnershipTypesList ? `- partnershipTypeId: Partnership type ID. Available: ${partnershipTypesList}` : ''}

Return valid JSON only, no explanations.`;
    }
    else if (type === 'lead') {
      prompt = `You are analyzing user input for creating a lead/sales prospect record. Extract structured data carefully.

CRITICAL RULES:
1. contactName must be ONLY the person's name (first + last name), NOT a sentence
2. organizationName must be ONLY the company/organization name
3. Do NOT include titles like "Dr.", "Mr.", "CEO" in the name - put those in position
4. Extract email and phone if they look like valid formats

User input: "${sanitizedText}"

## EXAMPLES

Example 1:
Input: "John Smith from Acme Corp called about partnership opportunities. He's the VP of Sales, email john@acme.com, phone +971501234567"
Output: {
  "contactName": "John Smith",
  "organizationName": "Acme Corp",
  "organizationNameAr": null,
  "position": "VP of Sales",
  "positionAr": null,
  "email": "john@acme.com",
  "phone": "+971501234567",
  "notes": "Called about partnership opportunities",
  "notesAr": null,
  "interests": "partnerships",
  "interestsAr": null
}

Example 2:
Input: "Met Dr. Sarah Al-Hashemi at the conference. She works for Emirates Research Foundation as Director of Innovation. Interested in AI and sustainability."
Output: {
  "contactName": "Sarah Al-Hashemi",
  "organizationName": "Emirates Research Foundation",
  "organizationNameAr": "مؤسسة الإمارات للأبحاث",
  "position": "Director of Innovation",
  "positionAr": "مدير الابتكار",
  "email": null,
  "phone": null,
  "notes": "Met at conference",
  "notesAr": "التقينا في المؤتمر",
  "interests": "AI, sustainability",
  "interestsAr": "الذكاء الاصطناعي، الاستدامة"
}

Example 3:
Input: "محمد العمري من شركة المستقبل للتقنية، مهتم بالتعاون في مجال الطاقة المتجددة"
Output: {
  "contactName": "Mohammed Al-Omari",
  "organizationName": "Future Technology Company",
  "organizationNameAr": "شركة المستقبل للتقنية",
  "position": null,
  "positionAr": null,
  "email": null,
  "phone": null,
  "notes": "Interested in collaboration in renewable energy",
  "notesAr": "مهتم بالتعاون في مجال الطاقة المتجددة",
  "interests": "renewable energy, collaboration",
  "interestsAr": "الطاقة المتجددة، التعاون"
}

Now extract from the user input above. Return ONLY valid JSON with these exact fields:
- contactName: Person's name only (no titles, not a sentence)
- organizationName: Company name in English
- organizationNameAr: Arabic translation of company name
- position: Job title in English
- positionAr: Arabic translation of position
- email: Email address if found
- phone: Phone number if found
- notes: Brief notes in English
- notesAr: Arabic translation of notes
- interests: Areas of interest (comma-separated)
- interestsAr: Arabic translation

Return valid JSON only, no explanations.`;
    }
    else {
      // Generic prompt for unknown type
      prompt = `You are analyzing user input. Extract structured data and provide both English and Arabic translations.

User input: "${sanitizedText}"

Extract and return a JSON object with these fields (provide null if not found):
- title: Main title in English
- titleAr: Arabic translation of the title
- description: Description in English
- descriptionAr: Arabic translation of the description
- date: Relevant date in YYYY-MM-DD format
- contactName: Contact person name if mentioned
- email: Email address if mentioned
- phone: Phone number if mentioned

Important:
- If input is in Arabic, translate to English and vice versa
- Return valid JSON only`;
    }

    const response = await llm.chat([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      maxTokens: 1500,
    });

    // Extract JSON from response (handle markdown code blocks)
    const content = response.content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    const jsonStr = jsonMatch[1] || content;
    
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (error) {
    console.error('LLM parsing error:', error);
    // Fallback to basic extraction
    return {
      title: getFirstSentence(text),
      description: text.slice(0, 800),
      date: extractDate(text),
      location: null,
      organizationName: extractOrganization(text),
      contactName: extractContactName(text),
    };
  }
}

/**
 * Parse intake text and extract structured data
 * Always returns a Promise for consistent async handling
 */
export async function parseIntakeText(
  text: string,
  type: AiIntakeType = 'event',
  options?: DropdownOptions
): Promise<AiIntakeResult> {
  const trimmed = text.trim();
  const summary = getFirstSentence(trimmed);
  // When type is provided, use it with high confidence
  const confidence = type === 'unknown' ? 0.5 : 0.9;

  // Use async LLM parsing if available
  if (llm.isAvailable()) {
    const fields = await parseWithLLM(trimmed, type, options);

    const missingFields: string[] = [];
    const suggestions: string[] = [];

    if (type === 'event') {
      if (!fields.title) missingFields.push('Event name');
      if (!fields.date) missingFields.push('Start date');
      if (!fields.location) suggestions.push('Add a location to clarify where the event is held.');
    }

    if (type === 'task') {
      if (!fields.title) missingFields.push('Task title');
      if (!fields.date) suggestions.push('Add a due date to keep the task on schedule.');
    }

    if (type === 'partnership') {
      if (!fields.organizationName) missingFields.push('Organization name');
      suggestions.push('Include key terms of the partnership for faster approvals.');
    }

    if (type === 'lead') {
      if (!fields.contactName) missingFields.push('Contact name');
      suggestions.push('Include a preferred contact method (email or phone).');
    }

    if (type === 'unknown') {
      suggestions.push('Highlight whether this is an event, task, partnership, or lead.');
    }

    return {
      type,
      confidence,
      summary,
      fields,
      missingFields,
      suggestions,
    };
  }

  // Fallback: synchronous basic extraction (wrapped in promise for consistency)
  const date = extractDate(trimmed);
  const orgName = extractOrganization(trimmed);
  const contactNameExtracted = extractContactName(trimmed);

  const fields: Record<string, string | null> = {
    title: summary,
    description: trimmed.slice(0, 800),
    date,
    location: null,
    organizationName: orgName,
    contactName: contactNameExtracted,
  };

  const missingFields: string[] = [];
  const suggestions: string[] = [];

  if (type === 'event') {
    if (!fields.title) missingFields.push('Event name');
    if (!fields.date) missingFields.push('Start date');
    if (!fields.location) suggestions.push('Add a location to clarify where the event is held.');
  }

  if (type === 'task') {
    if (!fields.title) missingFields.push('Task title');
    if (!fields.date) suggestions.push('Add a due date to keep the task on schedule.');
  }

  if (type === 'partnership') {
    if (!fields.organizationName) missingFields.push('Organization name');
    suggestions.push('Include key terms of the partnership for faster approvals.');
  }

  if (type === 'lead') {
    if (!fields.contactName) missingFields.push('Contact name');
    suggestions.push('Include a preferred contact method (email or phone).');
  }

  if (type === 'unknown') {
    suggestions.push('Highlight whether this is an event, task, partnership, or lead.');
  }

  return {
    type,
    confidence,
    summary,
    fields,
    missingFields,
    suggestions,
  };
}
