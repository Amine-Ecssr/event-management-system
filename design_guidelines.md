# Design Guidelines: Interactive Annual Events Calendar

## Design Approach
**Reference-Based Approach**: Inspired by Abu Dhabi Media Office events calendar - clean, professional layout with dual-view presentation optimized for browsing annual events efficiently.

## Typography System
**Font Families:**
- Headers & UI Elements: Montserrat (Google Fonts) - weights 400, 600, 700
- Body & Descriptions: Open Sans (Google Fonts) - weights 400, 600

**Type Scale:**
- Page Title: text-3xl font-bold (Montserrat)
- Month Header: text-2xl font-semibold (Montserrat)
- Event Titles (Calendar): text-sm font-semibold (Montserrat)
- Event Titles (List): text-lg font-semibold (Montserrat)
- Day Numbers: text-lg font-medium (Montserrat)
- Body Text: text-base (Open Sans)
- Labels/Metadata: text-sm (Open Sans)

## Color Palette (User-Specified)
- **Primary Gold**: #C5A572 - CTA buttons, active states, accents
- **Secondary Blue**: #1B365D - headers, navigation, links
- **Background White**: #FFFFFF - main background
- **Text Dark Grey**: #2C3E50 - primary text
- **Accent Light Blue**: #E8F4FD - hover states, subtle highlights
- **Calendar Grid**: #F8F9FA - cell backgrounds, borders

## Layout System
**Spacing Primitives**: Use Tailwind units of 4, 5, 6, 8, 12, 16, 20 (e.g., p-4, gap-6, mt-8, py-20)

**Container Structure:**
- Max width: max-w-7xl for main content
- Page padding: px-4 md:px-6 lg:px-8
- Section spacing: py-12 md:py-16

## Component Library

### 1. Calendar Grid View
**Layout:**
- 7-column grid for weekdays (Sunday-Saturday)
- Equal-height cells with min-height for visual consistency
- Multi-day events span across columns horizontally
- Responsive: Stack to list-style on mobile (< 768px)

**Day Cells:**
- Border: 1px solid #F8F9FA
- Padding: p-2 md:p-3
- Day number positioned top-left
- Event tags/badges below day number
- Hover: subtle background change to #E8F4FD

**Event Display (Desktop):**
- Events shown as horizontal bars spanning their duration
- Event bar background: #C5A572 with 90% opacity
- Text: white, truncated with ellipsis
- Border-radius: rounded-md
- Hover: Scale slightly (scale-105) with deeper gold tone

**Event Markers (Mobile):**
- Small colored dots beneath day numbers indicating events
- Gold dot for each event on that date
- Prevents clutter on small screens

### 2. List View
**Event Cards:**
- Card layout with clean borders (border border-gray-200)
- Padding: p-6
- Spacing between cards: space-y-4
- Shadow: shadow-sm hover:shadow-md transition
- Border-left accent: 4px solid #C5A572

**Card Content Structure:**
- Event title: Large, bold, #1B365D
- Date range badge: Inline, subtle background (#E8F4FD), rounded-full px-3 py-1
- Location: Icon + text in #2C3E50
- Description preview: 2-line truncate
- "View Details" link: #C5A572, underline on hover

### 3. Navigation Controls
**Month Navigation:**
- Centered month/year display (text-2xl)
- Left/right chevron buttons on sides
- Buttons: Rounded, minimal style, hover state with #E8F4FD background
- Sticky positioning on scroll for easy access

**View Toggle:**
- Button group: Calendar icon / List icon
- Active state: #1B365D background with white icon
- Inactive: Border only, #2C3E50 icon
- Mobile: Prominent toggle at top with clear labels

### 4. Event Detail Modal
**Modal Overlay:**
- Semi-transparent backdrop (bg-black/50)
- Modal centered, max-w-2xl
- Background: white with shadow-2xl
- Border-radius: rounded-lg
- Padding: p-8

**Content Layout:**
- Event title: text-3xl font-bold #1B365D
- Date range banner: Full-width, #E8F4FD background, py-4
- Information sections: Icon + label pairs (calendar, location, link)
- Description: Full text, proper line spacing (leading-relaxed)
- CTA button: #C5A572 background, white text, full-width or centered
- Close button: Top-right, subtle gray

### 5. Data Entry Interface (Admin)
**Access:**
- Admin login separate from public view
- Protected route or authentication modal

**Form Layout:**
- Clean form with labeled fields
- Grid layout for organized input: 2-column on desktop
- Fields: Event Name, Description (textarea), Start Date, End Date, Location, URL
- Date pickers: Modern, accessible date selection
- Validation indicators: Red for errors, green for valid

**Form Actions:**
- Primary "Save Event" button: #C5A572
- Secondary "Cancel" button: outline style
- "Delete Event" button: red, positioned separately
- Success/error toast notifications

**Event Management List:**
- Table view of all events with edit/delete actions
- Search/filter bar at top
- Sortable columns (date, name, location)
- Quick edit icons in #1B365D
- Confirmation dialogs for deletions

## Interactive States
**Hover Effects:**
- Calendar cells: Background tint to #E8F4FD
- Event bars/cards: Slight elevation (shadow increase)
- Buttons: Background darken 10%, smooth transition
- Links: Underline appearance

**Active States:**
- Selected month: Bold with #C5A572 underline
- Current day: Distinct border (2px solid #C5A572)
- Active view toggle: Filled background #1B365D

## Responsive Behavior
**Desktop (≥1024px):**
- Full calendar grid (7 columns)
- Side-by-side month controls and export
- List cards in 1-column for readability

**Tablet (768px-1023px):**
- Full calendar maintained
- Controls stack vertically if needed
- Reduced padding

**Mobile (<768px):**
- Calendar shows day numbers with event dots only
- List view becomes primary experience
- Large touch targets (min 44px)
- Month navigation full-width
- View toggle prominent and labeled

## Icons
**Library:** Heroicons (via CDN)
- Calendar icon for dates
- Location pin for venues
- External link for URLs
- Chevrons for navigation
- Plus icon for adding events
- Pencil for editing
- Trash for deletion

## Images
**No hero image required** - This is a utility-focused application prioritizing calendar functionality over visual marketing.

**Optional Event Thumbnails:**
- If events include images, display as small thumbnails in list view (64px × 64px)
- Positioned left of event title in cards
- Rounded corners (rounded-md)

## Accessibility
- ARIA labels for calendar navigation
- Keyboard navigation through dates
- Focus indicators with #C5A572 outline
- Screen reader announcements for view changes
- Form labels explicitly connected to inputs
- Color contrast meets WCAG AA standards

## Database Considerations
Events stored with fields: id, name, description, start_date, end_date, location, url, created_at, updated_at
Admin interface provides CRUD operations with immediate UI updates