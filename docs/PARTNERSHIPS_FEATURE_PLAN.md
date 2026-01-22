# Partnership Management Feature Plan

## Overview

This document outlines the implementation plan for the **Partnership Management** feature in EventVue. This feature allows administrators to track and manage organizational partnerships, monitor their status, and analyze the relationship through joint events, activities, and interactions.

---

## 🎯 Goals

1. **Track Partnership Status**: Differentiate between active partnerships and other organizations
2. **Store Partnership Metadata**: Agreement details, signing dates, partnership types
3. **Measure Engagement**: Track joint events, activities, and overall relationship health
4. **Provide Insights**: Dashboard showing partnership analytics and activity history

---

## 📊 Data Model Changes

### 1. Extend Existing `organizations` Table

The existing `organizations` table stores basic organization information. We'll extend it with partnership-specific fields:

```typescript
// New fields to add to organizations table (migration)
isPartner: boolean("is_partner").notNull().default(false),
partnershipStatus: text("partnership_status"), // 'active', 'pending', 'suspended', 'terminated'
partnershipType: text("partnership_type"), // 'strategic', 'sponsor', 'media', 'academic', 'government', 'corporate', 'ngo'
partnershipStartDate: date("partnership_start_date"),
partnershipEndDate: date("partnership_end_date"), // null = indefinite
agreementSignedBy: text("agreement_signed_by"), // Name of person who signed
agreementSignedByUs: text("agreement_signed_by_us"), // Our representative who signed
partnershipNotes: text("partnership_notes"), // General notes about the partnership
logoKey: text("logo_key"), // MinIO object key for partner logo
website: text("website"),
primaryContactId: integer("primary_contact_id").references(() => contacts.id), // Link to main contact person
```

### 2. New `partnership_agreements` Table

Store detailed agreement documents and history:

```typescript
export const partnershipAgreements = pgTable("partnership_agreements", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Agreement details
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  agreementType: text("agreement_type").notNull(), // 'mou', 'nda', 'sponsorship', 'collaboration', 'other'
  
  // Dates
  signedDate: date("signed_date"),
  effectiveDate: date("effective_date"),
  expiryDate: date("expiry_date"), // null = no expiry
  
  // Signatories
  partnerSignatory: text("partner_signatory"),
  partnerSignatoryTitle: text("partner_signatory_title"),
  ourSignatory: text("our_signatory"),
  ourSignatoryTitle: text("our_signatory_title"),
  
  // Document storage (MinIO)
  documentKey: text("document_key"), // MinIO object key for agreement PDF
  documentFileName: text("document_file_name"),
  
  // Status
  status: text("status").notNull().default('draft'), // 'draft', 'pending_approval', 'active', 'expired', 'terminated'
  
  // Metadata
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 3. New `partnership_activities` Table

Track activities and interactions under the partnership umbrella:

```typescript
export const partnershipActivities = pgTable("partnership_activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Activity details
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  activityType: text("activity_type").notNull(), // 'joint_event', 'sponsorship', 'collaboration', 'training', 'exchange', 'meeting', 'other'
  
  // Date and timing
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  
  // Linked event (optional - if activity is tied to an event)
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'set null' }),
  
  // Outcome and impact
  outcome: text("outcome"),
  outcomeAr: text("outcome_ar"),
  impactScore: integer("impact_score"), // 1-5 scale
  
  // Metadata
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 4. New `partnership_contacts` Junction Table

Link contacts to partnerships with roles:

```typescript
export const partnershipContacts = pgTable("partnership_contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  role: text("role"), // 'primary', 'liaison', 'technical', 'executive', 'other'
  roleAr: text("role_ar"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_partnership_contact").on(table.organizationId, table.contactId),
]);
```

---

## 🖥️ UI/UX Design

### Navigation

Add "Partnerships" to the admin navigation under a new "Relationships" section:
- Path: `/admin/partnerships`
- Icon: `Handshake` from lucide-react
- Access: Admin and Superadmin only

### Page Structure

#### 1. Partnerships List Page (`/admin/partnerships`)

**Header Section:**
- Page title: "Partnerships"
- Stats cards showing:
  - Total Partners
  - Active Partnerships
  - Pending Agreements
  - Expiring Soon (within 90 days)

**Filter Bar:**
- Search by organization name
- Filter by partnership status (Active, Pending, Suspended, Terminated)
- Filter by partnership type (Strategic, Sponsor, Academic, etc.)
- Filter by date range (partnership start date)

**List View:**
- Card-based layout showing:
  - Organization logo (or placeholder)
  - Organization name (English/Arabic)
  - Partnership type badge
  - Status badge (color-coded)
  - Partnership duration
  - Primary contact name
  - Quick stats: # of events, # of activities
  - Actions: View Details, Edit Partnership

**Add Partner Button:**
- Opens modal to:
  1. Select existing organization OR create new
  2. Fill partnership details

#### 2. Partnership Detail Page (`/admin/partnerships/:organizationId`)

**Header Section:**
- Back navigation
- Organization logo and name
- Status badge
- Partnership type badge
- Quick actions: Edit, Download Agreement, End Partnership

**Info Cards Row:**
- Partnership Start Date
- Agreement Type
- Primary Contact
- Total Joint Events

**Tabs:**

**Tab 1: Overview**
- Partnership summary
- Agreement details
- Signatories information
- Key dates (signed, effective, expiry)

**Tab 2: Agreements**
- List of all agreements with this partner
- Upload new agreement
- Download/view existing agreements
- Agreement status timeline

**Tab 3: Activities**
- Timeline of all activities
- Add new activity
- Filter by activity type
- Link to related events

**Tab 4: Events**
- List of joint events (from `events` where organizers contains this organization OR via `partnership_activities`)
- Show event cards with:
  - Event name, dates, location
  - Activity type (sponsor, co-organizer, etc.)

**Tab 5: Contacts**
- List of associated contacts from this organization
- Add/remove contacts from partnership
- Assign roles (Primary, Liaison, etc.)

**Tab 6: Analytics**
- Engagement metrics over time
- Activity frequency chart
- Event participation stats

---

## 📁 File Structure

### Frontend

```
client/src/
├── pages/
│   ├── Partnerships.tsx           # Main list page
│   └── PartnershipDetail.tsx      # Detail page
├── components/
│   ├── partnerships/
│   │   ├── PartnershipCard.tsx    # Card for list view
│   │   ├── PartnershipForm.tsx    # Create/edit partnership
│   │   ├── AgreementUpload.tsx    # Agreement document upload
│   │   ├── ActivityTimeline.tsx   # Activity timeline component
│   │   ├── PartnershipStats.tsx   # Stats cards component
│   │   └── PartnerContactList.tsx # Contact management
├── i18n/locales/
│   ├── en/partnerships.json       # English translations
│   └── ar/partnerships.json       # Arabic translations
```

### Backend

```
server/
├── routes/                        # Route modules
│   └── partnership.routes.ts      # Partnership routes
├── repositories/                  # Data access
│   └── partnership-repository.ts  # Partnership storage methods
shared/
└── schema.ts                      # Add partnership tables
migrations/
└── XXXX_add_partnerships.sql      # Migration file
```

---

## 🔌 API Endpoints

### Organizations (Extended)
```
GET    /api/organizations/partners           # Get all partner organizations
PUT    /api/organizations/:id/partnership    # Update partnership info
DELETE /api/organizations/:id/partnership    # Remove partnership status
```

### Partnership Agreements
```
GET    /api/organizations/:id/agreements     # Get agreements for org
POST   /api/organizations/:id/agreements     # Create new agreement
GET    /api/agreements/:id                   # Get single agreement
PUT    /api/agreements/:id                   # Update agreement
DELETE /api/agreements/:id                   # Delete agreement
POST   /api/agreements/:id/document          # Upload agreement document
GET    /api/agreements/:id/document          # Download agreement document
```

### Partnership Activities
```
GET    /api/organizations/:id/activities     # Get activities for org
POST   /api/organizations/:id/activities     # Create new activity
GET    /api/activities/:id                   # Get single activity
PUT    /api/activities/:id                   # Update activity
DELETE /api/activities/:id                   # Delete activity
```

### Partnership Contacts
```
GET    /api/organizations/:id/partnership-contacts   # Get contacts for partnership
POST   /api/organizations/:id/partnership-contacts   # Link contact to partnership
PUT    /api/partnership-contacts/:id                 # Update contact role
DELETE /api/partnership-contacts/:id                 # Remove contact from partnership
```

### Analytics
```
GET    /api/organizations/:id/partnership-stats      # Get partnership statistics
GET    /api/partnerships/overview                     # Get overall partnership metrics
```

---

## 🌐 i18n Keys Structure

```json
// partnerships.json
{
  "title": "Partnerships",
  "subtitle": "Manage organizational partnerships and collaborations",
  "stats": {
    "totalPartners": "Total Partners",
    "activePartnerships": "Active Partnerships",
    "pendingAgreements": "Pending Agreements",
    "expiringSoon": "Expiring Soon"
  },
  "status": {
    "active": "Active",
    "pending": "Pending",
    "suspended": "Suspended",
    "terminated": "Terminated"
  },
  "type": {
    "strategic": "Strategic",
    "sponsor": "Sponsor",
    "media": "Media",
    "academic": "Academic",
    "government": "Government",
    "corporate": "Corporate",
    "ngo": "NGO"
  },
  "agreementType": {
    "mou": "MOU",
    "nda": "NDA",
    "sponsorship": "Sponsorship",
    "collaboration": "Collaboration",
    "other": "Other"
  },
  "activityType": {
    "joint_event": "Joint Event",
    "sponsorship": "Sponsorship",
    "collaboration": "Collaboration",
    "training": "Training",
    "exchange": "Exchange",
    "meeting": "Meeting",
    "other": "Other"
  },
  "tabs": {
    "overview": "Overview",
    "agreements": "Agreements",
    "activities": "Activities",
    "events": "Events",
    "contacts": "Contacts",
    "analytics": "Analytics"
  },
  "form": {
    "selectOrganization": "Select Organization",
    "createNew": "Create New Organization",
    "partnershipType": "Partnership Type",
    "startDate": "Start Date",
    "endDate": "End Date (optional)",
    "notes": "Notes"
  },
  "actions": {
    "addPartner": "Add Partner",
    "editPartnership": "Edit Partnership",
    "endPartnership": "End Partnership",
    "uploadAgreement": "Upload Agreement",
    "addActivity": "Add Activity"
  }
}
```

---

## 🔄 Integration Points

### Existing Organizations Table
- Extends existing `organizations` table with partnership fields
- No data migration needed - new fields are optional/nullable
- Maintains backward compatibility with Contacts feature

### Events Integration
- Partnership activities can link to events
- Partner organizations appear in event organizers
- Events filter by partner organization

### Contacts Integration
- Partnership contacts are existing contacts linked via junction table
- Contact's organization can be marked as partner
- Primary contact for partnership

---

## 📋 Implementation Tasks

### Phase 1: Database & Backend (2-3 days)
- [ ] Create migration file for organization partnership fields
- [ ] Create `partnership_agreements` table
- [ ] Create `partnership_activities` table
- [ ] Create `partnership_contacts` table
- [ ] Update `shared/schema.ts` with new types and schemas
- [ ] Add repository methods to `server/repositories/partnership-repository.ts`
- [ ] Create route module `server/routes/partnership.routes.ts`
- [ ] Mount route in `server/routes.ts`

### Phase 2: Frontend - List Page (2 days)
- [ ] Create `Partnerships.tsx` page
- [ ] Create `PartnershipCard.tsx` component
- [ ] Create `PartnershipForm.tsx` for adding partnerships
- [ ] Add route to `App.tsx`
- [ ] Add navigation item
- [ ] Create i18n translation files

### Phase 3: Frontend - Detail Page (3 days)
- [ ] Create `PartnershipDetail.tsx` page
- [ ] Create Overview tab with partnership info
- [ ] Create Agreements tab with upload functionality
- [ ] Create Activities tab with timeline
- [ ] Create Events tab with event list
- [ ] Create Contacts tab with contact management
- [ ] Create Analytics tab with charts

### Phase 4: Testing & Polish (1 day)
- [ ] Test all CRUD operations
- [ ] Test file upload/download
- [ ] Test RTL layout
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty states

---

## 📝 Notes & Considerations

1. **Logo Storage**: Partner logos stored in MinIO under `partnerships/logos/` prefix
2. **Agreement Documents**: Stored in MinIO under `partnerships/agreements/` prefix
3. **Access Control**: Admin and Superadmin only
4. **Audit Logging**: All partnership changes should be logged
5. **Data Privacy**: Partnership contacts are linked, not duplicated
6. **Performance**: Index on `is_partner` field for filtering
