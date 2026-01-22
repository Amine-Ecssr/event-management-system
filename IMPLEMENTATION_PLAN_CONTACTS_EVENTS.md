# Implementation Plan: Contacts and Events Attendee Tracking

## Overview
This document outlines the plan to implement enhanced contacts management and event attendee tracking features for the ECSSR Events Calendar application.

## 🎯 Key Highlights

### Event Details Page (NEW)
- **Full-page dedicated view** for comprehensive event information
- Expansion of current event detail modal into a complete page
- **Viewable and exportable attendee list** with full contact details
- Accessible via `/admin/events/:eventId`
- All event information consolidated in one place

### 🔒 Archive Privacy (CRITICAL)
- **Only attendee count** transferred to archived events
- **No individual contact information** stored in archives
- Prevents data leakage in public archive
- Full attendee details remain in admin-only contacts database
- Privacy-compliant design for public viewing

## Requirements Summary

### Contacts Module
1. **Group by Entity View**
   - Group contacts by organization
   - Group contacts by position
   - Group contacts by country
   - Filterable and sortable views

2. **Export/Import Contacts List**
   - Export contacts to CSV format
   - Import contacts from CSV with validation
   - Handle duplicate detection (by email or name)

3. **Event Attendance Tracking**
   - Track which events each contact attended
   - Display attendance history on contact details
   - Show attendance statistics (e.g., most active attendees)

4. **Enhanced Filtering and Sorting**
   - Filter by organization, position, country
   - Sort by attendance count (who attended most events)
   - Sort by name, creation date, etc.
   - Search functionality across all fields

### Events Module
1. **Event Details Page**
   - Dedicated page for viewing comprehensive event information
   - Expansion of the current event detail modal into a full page
   - **Viewable and exportable attendee list** with full contact information
   - Accessible via direct URL (e.g., `/admin/events/:eventId`)
   - Includes all event details, stakeholders, speakers, and attendees in one place

2. **CSV Upload/Download for Attendees**
   - Upload attendee list CSV for each event
   - Download attendee list CSV from event
   - Permission-based access (specific stakeholders/departments if allowed by superadmin)

3. **Cross-Verification with Contacts**
   - Check if uploaded attendee exists in contacts database
   - If new attendee: add to contacts database
   - If existing attendee: link to event and update attendance count
   - Handle matching logic (by email, name, or combination)

4. **Archive Data Privacy**
   - **CRITICAL:** Only attendee count is transferred to archived events
   - Full contact information (names, emails, phone numbers) is NOT included in archives
   - This prevents data leakage and ensures archived events remain privacy-compliant
   - Archived events show `actualAttendees: number` only, not individual attendee details

---

## Database Schema Changes

### 1. New Table: `event_attendees`
Junction table linking events to contacts who attended (not just speakers).

```typescript
export const eventAttendees = pgTable("event_attendees", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  attendedAt: timestamp("attended_at").defaultNow(), // When attendance was recorded
  notes: text("notes"), // Optional notes about attendance
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_event_attendees_event_id").on(table.eventId),
  index("IDX_event_attendees_contact_id").on(table.contactId),
  unique("unique_event_attendee").on(table.eventId, table.contactId), // Prevent duplicate attendance records
]);
```

### 2. Enhanced Contacts Table (if needed)
The existing contacts table already has all necessary fields. We may add computed fields for:
- `totalEventsAttended` (computed from event_attendees count)
- `lastEventAttended` (computed from most recent event_attendees entry)

These can be computed at query time rather than stored.

### 3. Archive Privacy Design

**⚠️ CRITICAL: Data Privacy Requirement**

The `event_attendees` junction table contains full contact information (names, emails, phone numbers, organizations). To prevent data leakage and maintain privacy compliance:

**Archive Transfer Rules:**
1. **Only Count**: When archiving an event, only `actualAttendees` (integer count) is transferred to `archived_events.actualAttendees`
2. **No Contact Details**: Individual attendee contact information is NEVER copied to archived events
3. **No Junction Table**: `event_attendees` records are NOT migrated to archive
4. **Separation of Concerns**: 
   - Active events (`events` table): Full attendee details available via `event_attendees`
   - Archived events (`archived_events` table): Only statistical count stored

**Privacy Safeguards:**
```typescript
// ✅ Correct: Archive with count only
const archivedEvent = {
  ...eventData,
  actualAttendees: attendeeCount, // Just the number
};

// ❌ Incorrect: DO NOT include individual attendee details
const archivedEvent = {
  ...eventData,
  attendees: contactsList, // NEVER do this
};
```

**Public Archive Implications:**
- Public archive displays aggregated statistics only
- No individual attendee names, emails, or contact details exposed
- Privacy-compliant for public viewing
- Attendee details remain in admin-only contacts database
- `lastEventAttended` (computed from most recent event_attendees entry)

These can be computed at query time rather than stored.

---

## Backend API Routes

### Contacts API Enhancements

#### 1. GET `/api/contacts` - Enhanced Filtering
**Query Parameters:**
- `page` (number) - Pagination page
- `limit` (number) - Items per page
- `search` (string) - Search across name, email, organization
- `organizationId` (number) - Filter by organization
- `positionId` (number) - Filter by position
- `countryId` (number) - Filter by country
- `isEligibleSpeaker` (boolean) - Filter speakers only
- `sortBy` (string) - Sort field: 'name', 'eventsAttended', 'createdAt'
- `sortOrder` (string) - 'asc' or 'desc'
- `groupBy` (string) - Group results: 'organization', 'position', 'country'

**Response:**
```json
{
  "contacts": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "groups": {
    // When groupBy is specified
    "organizationId_1": {
      "name": "Organization Name",
      "contacts": [...]
    }
  }
}
```

#### 2. GET `/api/contacts/:id/events` - Get Contact's Event Attendance
**Response:**
```json
{
  "contact": {...},
  "attendedEvents": [
    {
      "eventId": "abc-123",
      "eventName": "Conference 2024",
      "eventDate": "2024-05-15",
      "location": "Abu Dhabi",
      "attendedAt": "2024-05-15T14:30:00Z",
      "role": "attendee", // or "speaker" if also in eventSpeakers
      "notes": "VIP guest"
    }
  ],
  "totalEventsAttended": 5,
  "speakerEvents": 2,
  "attendeeOnlyEvents": 3,
  "firstEvent": {
    "eventId": "xyz-789",
    "eventName": "First Conference",
    "eventDate": "2023-01-10"
  },
  "lastEvent": {
    "eventId": "abc-123",
    "eventName": "Conference 2024",
    "eventDate": "2024-05-15"
  }
}
```

#### 2.5. GET `/api/contacts/statistics` - Get Contacts Statistics (NEW)
Get overall statistics about contacts and their event attendance.

**Query Parameters:**
- `limit` (number) - Number of top attendees to return (default: 5)
- `includeOrganizations` (boolean) - Include organization statistics (default: false)

**Response:**
```json
{
  "totalContacts": 150,
  "contactsWithEvents": 85,
  "contactsWithoutEvents": 65,
  "totalEventAttendances": 425,
  "averageAttendancePerContact": 2.83,
  "topAttendees": [
    {
      "contactId": 1,
      "nameEn": "John Doe",
      "nameAr": "جون دو",
      "organization": "ACME Corp",
      "eventsAttended": 15,
      "speakerAppearances": 5
    },
    {
      "contactId": 2,
      "nameEn": "Jane Smith",
      "nameAr": "جين سميث",
      "organization": "Tech Inc",
      "eventsAttended": 12,
      "speakerAppearances": 3
    }
  ]
}
```

#### 2.6. GET `/api/contacts/organizations/statistics` - Get Organization-Level Statistics (NEW)
Get detailed statistics grouped by organization to see which organizations have the highest engagement.

**Query Parameters:**
- `limit` (number) - Number of top organizations to return (default: 10)
- `sortBy` (string) - Sort field: 'totalAttendances', 'attendanceRate', 'uniqueContacts', 'averagePerContact' (default: 'totalAttendances')
- `sortOrder` (string) - 'asc' or 'desc' (default: 'desc')

**Response:**
```json
{
  "totalOrganizations": 45,
  "organizationsWithAttendance": 32,
  "organizationStatistics": [
    {
      "organizationId": 1,
      "organizationNameEn": "ACME Corporation",
      "organizationNameAr": "شركة أكمي",
      "totalContacts": 25,
      "activeContacts": 18,
      "totalEventAttendances": 87,
      "uniqueEventsAttended": 15,
      "averageAttendancePerContact": 3.48,
      "attendanceRate": 72.0,
      "speakerAppearances": 12,
      "topAttendee": {
        "contactId": 1,
        "nameEn": "John Doe",
        "eventsAttended": 15
      }
    },
    {
      "organizationId": 2,
      "organizationNameEn": "Tech Innovations Inc",
      "organizationNameAr": "شركة التقنيات المبتكرة",
      "totalContacts": 15,
      "activeContacts": 12,
      "totalEventAttendances": 65,
      "uniqueEventsAttended": 12,
      "averageAttendancePerContact": 4.33,
      "attendanceRate": 80.0,
      "speakerAppearances": 8,
      "topAttendee": {
        "contactId": 45,
        "nameEn": "Sarah Ahmed",
        "eventsAttended": 18
      }
    }
  ],
  "overallAverageAttendanceRate": 65.5
}
```

**Calculation Notes:**
- `activeContacts`: Contacts from this organization who attended at least 1 event
- `attendanceRate`: (activeContacts / totalContacts) * 100
- `averageAttendancePerContact`: totalEventAttendances / activeContacts
- `uniqueEventsAttended`: Number of distinct events attended by organization members

#### 3. POST `/api/contacts/export` - Export Contacts CSV
**Request Body:**
```json
{
  "filters": {
    "organizationId": 1,
    "includeAttendance": true // Include attendance stats in export
  }
}
```

**Response:** CSV file download with headers:
```csv
nameEn,nameAr,title,titleAr,organization,organizationAr,position,positionAr,country,phone,email,isEligibleSpeaker,eventsAttended,createdAt
```

#### 4. POST `/api/contacts/import` - Import Contacts CSV
**Request:** Multipart form with CSV file

**Response:**
```json
{
  "imported": 45,
  "updated": 5,
  "skipped": 2,
  "errors": [
    {
      "row": 3,
      "error": "Invalid email format"
    }
  ]
}
```

### Events API Enhancements

#### 5. POST `/api/events/:id/attendees/upload` - Upload Attendees CSV
**Permissions:** Admin, Superadmin, or allowed Department (based on settings)

**Request:** Multipart form with CSV file containing attendee data

**CSV Format:**
```csv
nameEn,nameAr,email,organization,position,country,phone,title,role
John Doe,جون دو,john@example.com,ACME Corp,Manager,AE,+971501234567,Dr.,Attendee
```

**Response:**
```json
{
  "eventId": "abc-123",
  "processed": 50,
  "newContacts": 10,      // New contacts added to database
  "existingContacts": 40, // Existing contacts linked to event
  "errors": [
    {
      "row": 5,
      "error": "Missing required field: email",
      "data": {...}
    }
  ]
}
```

**Processing Logic:**
1. Parse CSV file
2. For each row:
   - Validate required fields (at least nameEn or email)
   - Check if contact exists (match by email first, then by nameEn+organization)
   - If exists: update contact info if different, link to event
   - If new: create contact, link to event
   - Track errors and continue processing
3. Return summary report

#### 6. GET `/api/events/:id/attendees` - Get Event Attendees
**Response:**
```json
{
  "eventId": "abc-123",
  "eventName": "Conference 2024",
  "attendees": [
    {
      "contactId": 1,
      "nameEn": "John Doe",
      "nameAr": "جون دو",
      "organization": "ACME Corp",
      "position": "Manager",
      "email": "john@example.com",
      "phone": "+971501234567",
      "attendedAt": "2024-05-15T14:30:00Z",
      "notes": null
    }
  ],
  "totalAttendees": 50,
  "speakers": 5,
  "regularAttendees": 45
}
```

#### 7. GET `/api/events/:id/attendees/download` - Download Attendees CSV
**Response:** CSV file with attendee information

#### 8. DELETE `/api/events/:eventId/attendees/:contactId` - Remove Attendee
Remove a contact from event attendees list.

### Settings API Enhancement

#### 9. PATCH `/api/settings` - Add Department Upload Permissions
**New Settings:**
```json
{
  "allowDepartmentAttendeeUpload": true,
  "departmentUploadPermissions": {
    "departmentId_1": true,
    "departmentId_2": false
  }
}
```

---

## Frontend UI Components

### Contacts Page Enhancements

#### 1. Enhanced Filters Section
```tsx
<div className="filters">
  <Input placeholder="Search contacts..." />
  <Select placeholder="Organization">
    <SelectItem value="all">All Organizations</SelectItem>
    {/* ... */}
  </Select>
  <Select placeholder="Position">
    <SelectItem value="all">All Positions</SelectItem>
    {/* ... */}
  </Select>
  <Select placeholder="Country">
    <SelectItem value="all">All Countries</SelectItem>
    {/* ... */}
  </Select>
  <Select placeholder="Sort By">
    <SelectItem value="name">Name</SelectItem>
    <SelectItem value="eventsAttended">Events Attended</SelectItem>
    <SelectItem value="createdAt">Date Added</SelectItem>
  </Select>
</div>
```

#### 1.5. Top Attendees Statistics Section (NEW)
Display key statistics above the contacts table with toggle for individual vs organization view:
```tsx
<Tabs defaultValue="individuals" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="individuals">Individual Statistics</TabsTrigger>
    <TabsTrigger value="organizations">Organization Statistics</TabsTrigger>
  </TabsList>
  
  <TabsContent value="individuals">
    <div className="statistics-cards grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalContacts}</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top Attendees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topAttendees.map((contact, idx) => (
              <div key={contact.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{idx + 1}</Badge>
                  <span className="font-medium">{contact.nameEn}</span>
                </div>
                <Badge>{contact.eventsAttended} events</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{avgAttendance.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">events per contact</p>
        </CardContent>
      </Card>
    </div>
  </TabsContent>
  
  <TabsContent value="organizations">
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Organizations by Engagement</h3>
        <Select value={orgSortBy} onValueChange={setOrgSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalAttendances">Total Attendances</SelectItem>
            <SelectItem value="attendanceRate">Attendance Rate</SelectItem>
            <SelectItem value="averagePerContact">Avg per Contact</SelectItem>
            <SelectItem value="uniqueContacts">Active Contacts</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Total Contacts</TableHead>
            <TableHead>Active Contacts</TableHead>
            <TableHead>Attendance Rate</TableHead>
            <TableHead>Total Attendances</TableHead>
            <TableHead>Avg per Contact</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizationStats.map((org, idx) => (
            <TableRow key={org.organizationId}>
              <TableCell>
                <Badge variant={idx < 3 ? 'default' : 'secondary'}>
                  #{idx + 1}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                {org.organizationNameEn}
              </TableCell>
              <TableCell>{org.totalContacts}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {org.activeContacts}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={org.attendanceRate} className="w-20" />
                  <span className="text-sm font-medium">
                    {org.attendanceRate.toFixed(1)}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge>{org.totalEventAttendances}</Badge>
              </TableCell>
              <TableCell>
                {org.averageAttendancePerContact.toFixed(1)}
              </TableCell>
              <TableCell>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => filterByOrganization(org.organizationId)}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <Card>
        <CardHeader>
          <CardTitle>Overall Average Attendance Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={overallAverageAttendanceRate} className="flex-1" />
            <span className="text-2xl font-bold">
              {overallAverageAttendanceRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Percentage of contacts per organization who have attended at least one event
          </p>
        </CardContent>
      </Card>
    </div>
  </TabsContent>
</Tabs>
```

#### 2. Group View Toggle
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="list">List View</TabsTrigger>
    <TabsTrigger value="organization">By Organization</TabsTrigger>
    <TabsTrigger value="position">By Position</TabsTrigger>
    <TabsTrigger value="country">By Country</TabsTrigger>
  </TabsList>
  <TabsContent value="list">
    {/* Regular contact list */}
  </TabsContent>
  <TabsContent value="organization">
    {/* Grouped by organization */}
  </TabsContent>
  {/* ... */}
</Tabs>
```

#### 2.5. Enhanced Contact List/Table with Events Attended Column (NEW)
Display events attended count in the main contacts table:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Organization</TableHead>
      <TableHead>Position</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Events Attended</TableHead> {/* NEW COLUMN */}
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {contacts.map((contact) => (
      <TableRow key={contact.id}>
        <TableCell>{contact.nameEn}</TableCell>
        <TableCell>{contact.organization}</TableCell>
        <TableCell>{contact.position}</TableCell>
        <TableCell>{contact.email}</TableCell>
        <TableCell>
          <Badge variant="secondary">
            {contact.eventsAttended || 0} events
          </Badge>
        </TableCell>
        <TableCell>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => viewContactDetails(contact.id)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

#### 3. Contact Detail Modal Enhancement
Expand the contact detail modal to show comprehensive information including event attendance:
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{contact.nameEn}</DialogTitle>
      <DialogDescription>
        {contact.organization} • {contact.position}
      </DialogDescription>
    </DialogHeader>
    
    <Tabs defaultValue="info">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="info">Contact Information</TabsTrigger>
        <TabsTrigger value="events">
          Events Attended ({eventsCount})
        </TabsTrigger>
        <TabsTrigger value="stats">Statistics</TabsTrigger>
      </TabsList>
      
      <TabsContent value="info">
        {/* Existing contact information fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name (EN)</Label>
            <p>{contact.nameEn}</p>
          </div>
          <div>
            <Label>Name (AR)</Label>
            <p>{contact.nameAr}</p>
          </div>
          {/* ... other fields ... */}
        </div>
      </TabsContent>
      
      <TabsContent value="events">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Event Attendance History</h3>
            <Badge variant="secondary">
              Total: {eventsCount} events
            </Badge>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendedEvents.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell className="font-medium">
                    {event.eventName}
                  </TableCell>
                  <TableCell>
                    {formatDate(event.eventDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.role === 'speaker' ? 'default' : 'secondary'}>
                      {event.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.location}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/admin/events/${event.eventId}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {attendedEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No event attendance recorded yet
            </div>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="stats">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Events Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{eventsCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Speaker Appearances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{speakerCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>First Event</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">
                {firstEvent ? formatDate(firstEvent.eventDate) : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                {firstEvent?.eventName}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Most Recent Event</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">
                {lastEvent ? formatDate(lastEvent.eventDate) : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                {lastEvent?.eventName}
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Close
      </Button>
      <Button onClick={() => editContact(contact.id)}>
        <Edit className="h-4 w-4 mr-2" />
        Edit Contact
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### 4. Import/Export Buttons
```tsx
<div className="actions">
  <Button onClick={exportContacts}>
    <Download /> Export CSV
  </Button>
  <Button onClick={openImportDialog}>
    <Upload /> Import CSV
  </Button>
</div>
```

### Event Details Page (NEW)

A dedicated full-page view for comprehensive event information, replacing/expanding the current modal.

#### Route
- Path: `/admin/events/:eventId`
- Accessible from event list by clicking event name or "View Details" button

#### Page Structure
```tsx
<div className="event-details-page">
  <PageHeader 
    title={event.name}
    subtitle={`${formatDate(event.startDate)} - ${formatDate(event.endDate)}`}
  >
    <Button onClick={onEdit}>Edit Event</Button>
    <Button onClick={onArchive}>Archive Event</Button>
  </PageHeader>

  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="stakeholders">Stakeholders & Tasks</TabsTrigger>
      <TabsTrigger value="speakers">Speakers</TabsTrigger>
      <TabsTrigger value="attendees">
        Attendees ({attendeesCount}) 
      </TabsTrigger>
      <TabsTrigger value="files">Files & Agendas</TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
      {/* Event details, description, location, etc. */}
    </TabsContent>

    <TabsContent value="attendees">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Event Attendees ({attendeesCount})</CardTitle>
            <div className="flex gap-2">
              <Button onClick={uploadAttendees}>
                <Upload /> Upload CSV
              </Button>
              <Button onClick={downloadAttendees}>
                <Download /> Export CSV
              </Button>
            </div>
          </div>
          <CardDescription>
            Full attendee list with contact information.
            Note: Only the total count is transferred to archives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Searchable, sortable attendee list */}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
```

#### Key Features
1. **Comprehensive Event View**: All event information in one place
2. **Attendee Management**: 
   - View full list of attendees with contact details
   - Search and filter attendees
   - Export attendee list to CSV
   - Upload new attendees via CSV
3. **Data Privacy**: 
   - ⚠️ **CRITICAL**: Full attendee details visible on this page
   - ⚠️ When archiving: Only `actualAttendees` count transferred to archive
   - ⚠️ No individual contact information stored in archived events
4. **Navigation**: 
   - Breadcrumb: Events > [Event Name]
   - Back button to return to events list
5. **Permissions**:
   - Admins/Superadmins: Full access
   - Departments: View only if granted permission

### Events Page Enhancements

#### 1. Event List - Add Navigation to Details Page
Update event cards/rows to link to the new details page:
```tsx
<Card onClick={() => setLocation(`/admin/events/${event.id}`)}>
  {/* Or add a "View Details" button */}
  <Button variant="ghost" onClick={() => navigate(`/admin/events/${event.id}`)}>
    <Eye /> View Details
  </Button>
</Card>
```

#### 2. Event Detail Modal - Attendees Tab (Optional if keeping modal)
Add new tab for managing attendees:
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
    <TabsTrigger value="speakers">Speakers</TabsTrigger>
    <TabsTrigger value="attendees">Attendees ({attendeesCount})</TabsTrigger>
  </TabsList>
  <TabsContent value="attendees">
    <div className="attendees-actions">
      <Button onClick={uploadAttendees}>
        <Upload /> Upload Attendees CSV
      </Button>
      <Button onClick={downloadAttendees}>
        <Download /> Download CSV
      </Button>
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Attendees list with remove option */}
      </TableBody>
    </Table>
  </TabsContent>
</Tabs>
```

#### 2. CSV Upload Dialog
```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Upload Attendees List</DialogTitle>
    <DialogDescription>
      Upload a CSV file with attendee information. 
      New contacts will be added to the database automatically.
    </DialogDescription>
  </DialogHeader>
  <div className="upload-area">
    <Input type="file" accept=".csv" />
    <Button onClick={downloadTemplate}>
      Download CSV Template
    </Button>
  </div>
  <DialogFooter>
    <Button onClick={processUpload}>Upload & Process</Button>
  </DialogFooter>
</Dialog>
```

---

## Implementation Steps

### Phase 1: Database & Schema (Priority: High)
1. Create migration file for `event_attendees` table
2. Add Zod schemas in `shared/schema.ts`
3. Run migration and test

### Phase 2: Backend API (Priority: High)
1. Implement contacts filtering/sorting logic in storage layer
2. Add `/api/contacts/export` endpoint
3. Add `/api/contacts/import` endpoint  
4. Add `/api/contacts/:id/events` endpoint (with enhanced response)
5. **Add `/api/contacts/statistics` endpoint** for overall statistics
6. **Add `/api/contacts/organizations/statistics` endpoint** for organization-level analytics
7. **Enhance contacts query to include `eventsAttended` count** (computed field)
8. Add `/api/events/:id/attendees/upload` with cross-verification logic
9. Add `/api/events/:id/attendees` endpoint
10. Add `/api/events/:id/attendees/download` endpoint
11. Add settings for department upload permissions

### Phase 3: Frontend - Contacts (Priority: Medium)
1. Update Contacts page with enhanced filters
2. Add group view tabs (by organization, position, country)
3. **Add statistics section** with toggle between:
   - Individual statistics (top attendees, average attendance)
   - **Organization statistics** (attendance rate, rankings, engagement metrics)
4. **Add "Events Attended" column** to contacts table
5. **Add "View" button** for each contact in the table
6. **Create enhanced Contact Detail Modal** with tabs:
   - Contact Information tab
   - Events Attended tab (with full attendance history)
   - Statistics tab (total events, speaker appearances, first/last event)
7. Add export/import buttons and dialogs
8. Add sorting by events attended
9. Implement `GET /api/contacts/statistics` endpoint integration
10. **Implement `GET /api/contacts/organizations/statistics` endpoint integration**
11. Implement `GET /api/contacts/:id/events` endpoint integration
12. **Add organization filter functionality** (click to view contacts from specific organization)

### Phase 4: Frontend - Events (Priority: High)
1. **Create Event Details Page** (`client/src/pages/EventDetail.tsx`)
   - Full-page view with tabs for overview, stakeholders, speakers, attendees, files
   - Attendees tab with viewable and exportable list
   - Add route `/admin/events/:eventId` in App.tsx
2. Update Events page to link to new details page
3. Create attendee upload dialog component
4. Create attendee list display with search, filter, and remove functionality
5. Add download attendees CSV functionality
6. Integrate with backend APIs
7. **Ensure archive logic only transfers attendee count** (not individual details)

### Phase 5: Archive Privacy Safeguards (Priority: High)
1. Review archive creation logic to ensure only `actualAttendees` count is transferred
2. Verify archived events do NOT include individual attendee contact information
3. Add validation to prevent accidental attendee data leakage to archives
4. Update archive display to show only attendee count
5. Document privacy measures in code comments

### Phase 6: Testing & Documentation (Priority: Medium)
1. Test contact import/export flow
2. Test attendee upload with new/existing contacts
3. Test cross-verification logic
4. Test permission-based access for department uploads
5. Test Event Details page navigation and functionality
6. **Test archive privacy**: Verify only count transferred, not contact details
7. Update documentation in `docs/` folder
8. Add user guide for new features

---

## File Changes Required

### New Files
- `migrations/XXXX_add_event_attendees_table.sql`
- `client/src/pages/EventDetail.tsx` - **NEW: Full-page event details view**
- `client/src/components/contacts/ContactImportDialog.tsx`
- `client/src/components/contacts/ContactGroupView.tsx`
- `client/src/components/contacts/ContactDetailModal.tsx` - **NEW: Enhanced contact details with attendance**
- `client/src/components/contacts/ContactStatistics.tsx` - **NEW: Statistics cards for top attendees**
- `client/src/components/contacts/OrganizationStatistics.tsx` - **NEW: Organization-level attendance analytics**
- `client/src/components/events/AttendeeUploadDialog.tsx`
- `client/src/components/events/AttendeesList.tsx`

### Modified Files
- `shared/schema.ts` - Add event_attendees table and schemas
- `server/storage.ts` - Add contact/attendee query functions
- `server/routes.ts` - Add new API endpoints, **ensure archive privacy**
- `client/src/App.tsx` - Add route for `/admin/events/:eventId`
- `client/src/pages/Contacts.tsx` - Enhanced filtering and views
- `client/src/pages/Events.tsx` - Add link to event details page
- `client/src/lib/types.ts` - Add TypeScript types
- `docs/ARCHITECTURE.md` - Document new features

---

## Permission Matrix

| Feature | Superadmin | Admin | Department | Stakeholder |
|---------|-----------|-------|------------|-------------|
| View Contacts | ✅ | ✅ | ❌ | ❌ |
| Add/Edit/Delete Contacts | ✅ | ✅ | ❌ | ❌ |
| Export Contacts | ✅ | ✅ | ❌ | ❌ |
| Import Contacts | ✅ | ✅ | ❌ | ❌ |
| View Event Details Page | ✅ | ✅ | ✅* | ❌ |
| Upload Event Attendees | ✅ | ✅ | ✅* | ❌ |
| Download Event Attendees | ✅ | ✅ | ✅* | ❌ |
| View Contact Event History | ✅ | ✅ | ❌ | ❌ |
| View Archived Event Attendees | ❌ | ❌ | ❌ | ❌ |

*Department access requires superadmin permission grant in settings

**Archive Privacy Note:** Archived events show only `actualAttendees` (count). Individual attendee contact information is never transferred to or visible in archives.

---

## CSV File Formats

### Contact Import/Export CSV
```csv
nameEn,nameAr,title,titleAr,organization,organizationAr,position,positionAr,country,phone,email,isEligibleSpeaker
John Doe,جون دو,Dr.,د.,ACME Corporation,شركة أكمي,CEO,الرئيس التنفيذي,AE,+971501234567,john@acme.com,true
```

### Event Attendees Upload CSV
```csv
nameEn,nameAr,email,organization,organizationAr,position,positionAr,country,phone,title,titleAr,notes
John Doe,جون دو,john@acme.com,ACME Corp,شركة أكمي,Manager,مدير,AE,+971501234567,Dr.,د.,VIP Guest
```

**Minimum Required Fields:** Either `email` OR `nameEn` must be provided

---

## Matching Logic for Cross-Verification

When uploading attendees CSV:

1. **Primary Match: Email**
   - If email provided and exists in contacts → Match found
   
2. **Secondary Match: Name + Organization**
   - If nameEn matches AND organization matches → Match found
   
3. **Tertiary Match: Name only (fuzzy)**
   - If nameEn is very similar (Levenshtein distance < 3) → Prompt for confirmation
   
4. **No Match**
   - Create new contact with provided information
   - If organization/position/country names provided as text, try to match existing ones or create new

---

## Error Handling

### CSV Upload Errors
- Invalid file format → Reject with clear error message
- Missing required fields → Skip row, log error, continue processing
- Duplicate entries in same CSV → Use first occurrence, log warning
- Invalid email format → Skip row, log error
- File too large (>5MB) → Reject with error message

### Contact Matching Ambiguity
- Multiple potential matches → Create new contact, log for manual review
- Conflicting data → Use CSV data, log old values for reference

---

## Success Metrics

1. **Contacts Module**
   - Users can export full contact list in <2 seconds
   - Contact import processes 100+ records in <10 seconds
   - Group views render in <1 second
   - Event attendance data loads in <1 second per contact

2. **Events Module**
   - Attendee CSV upload processes 200+ records in <15 seconds
   - Cross-verification accuracy >95%
   - New contact creation from upload works 100% of time
   - Download attendees CSV completes in <2 seconds

3. **User Experience**
   - Clear error messages for all failures
   - Progress indicators for long-running operations
   - Success confirmations with actionable details
   - No data loss during imports/uploads

---

## Future Enhancements (Out of Scope)

1. Automatic duplicate detection and merging in contacts
2. Email notifications to attendees after upload
3. QR code generation for event check-in
4. Mobile app integration for attendance tracking
5. Bulk SMS to event attendees
6. Attendance certificates generation
7. Integration with external registration systems

---

## Questions for Review

1. Should we allow partial imports if some rows have errors?
   - **Recommendation:** Yes, import valid rows and report errors
   
2. What should happen if an uploaded attendee email matches but name is different?
   - **Recommendation:** Update contact name if newer, or prompt for confirmation
   
3. Should attendees be visible to department users for their assigned events?
   - **Recommendation:** Only if superadmin enables in settings
   
4. Should we track attendee check-in time vs. registration time?
   - **Recommendation:** Use single timestamp for now, can enhance later
   
5. Maximum file size for CSV uploads?
   - **Recommendation:** 5MB (approximately 10,000 rows)

---

## Dependencies

### NPM Packages (Already Installed)
- `papaparse` - CSV parsing
- `multer` - File upload handling
- `zod` - Validation

### Database
- PostgreSQL 16 with existing migrations
- No additional database extensions needed

---

## Rollback Plan

If issues arise:
1. Database migration can be rolled back via down migration
2. API endpoints can be disabled via feature flag
3. Frontend changes are non-breaking (additive only)
4. No data loss - new tables/columns only

---

## Timeline Estimate

- **Phase 1 (Database & Schema):** 2-3 hours
- **Phase 2 (Backend API):** 8-10 hours
  - Includes organization statistics endpoint and complex aggregation queries
- **Phase 3 (Frontend - Contacts):** 6-8 hours
  - Includes individual and organization statistics views
- **Phase 4 (Frontend - Event Details Page & Attendees):** 6-8 hours
  - Event Details Page creation: 3-4 hours
  - Attendee management UI: 3-4 hours
- **Phase 5 (Archive Privacy Safeguards):** 2-3 hours
- **Phase 6 (Testing & Documentation):** 3-4 hours

**Total Estimated Time:** 27-36 hours

---

## Approval & Sign-off

This implementation plan is ready for review by:
- [ ] Technical Lead
- [ ] Product Owner
- [ ] QA Lead

Once approved, development can proceed following the phases outlined above.

---

**Document Version:** 1.1  
**Created:** 2025-12-06  
**Last Updated:** 2025-12-06  
**Author:** AI Coding Agent

**Changelog:**
- v1.1: Added Event Details Page requirement, highlighted archive privacy safeguards
- v1.0: Initial implementation plan
