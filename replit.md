# ECSSR Annual Events Calendar Application

## Overview
This interactive web application provides an annual events calendar for the ECSSR, offering various viewing formats (monthly, quarterly, bi-annually, yearly) with synchronized calendar and event list displays. Key features include interactive hover effects, CSV export, and a secure admin interface for comprehensive event management (CRUD, CSV import, bulk delete). The application integrates ECSSR branding, aiming to be an efficient platform for event dissemination, enhancing public engagement and internal organization.

## Recent Changes (December 20, 2025)

**Routes & Storage Refactoring Complete:**
- **Modular Routes:** Extracted all 280+ routes from monolithic `routes.ts` into 15 domain-specific route modules in `server/routes/`
- **Repository Pattern:** Refactored `storage.ts` from a single 5,699-line class into 16 domain-specific repositories in `server/repositories/`
- **Shared Utilities:** Created `server/routes/utils.ts` with shared middleware, helpers, and types
- **Backward Compatibility:** Storage facade in `server/repositories/index.ts` maintains the same API for existing code
- **E2E Test Coverage:** Updated test infrastructure to work with the new modular structure
- **Documentation:** Updated all docs to reflect the new architecture

**Route Modules:**
- `event.routes.ts` - Event CRUD operations
- `task.routes.ts` - Task management and workflows
- `stakeholder.routes.ts` - Stakeholder/department management
- `organization.routes.ts` - Organizations, positions, contacts
- `partnership.routes.ts` - Partnership management
- `lead.routes.ts` - Lead tracking
- `invitation.routes.ts` - Event invitations and attendees
- `archive.routes.ts` - Archive operations
- `settings.routes.ts` - Application settings
- `admin.routes.ts` - Admin user management, Keycloak sync
- `integration.routes.ts` - Scraper, reminders, updates
- `health.routes.ts`, `category.routes.ts`, `event-files.routes.ts`

**Repositories:**
- `event-repository.ts`, `task-repository.ts`, `department-repository.ts`
- `partnership-repository.ts`, `lead-repository.ts`, `contact-repository.ts`
- `archive-repository.ts`, `invitation-repository.ts`, `workflow-repository.ts`
- `settings-repository.ts`, `reminder-repository.ts`, `update-repository.ts`
- `user-repository.ts`, `auth-repository.ts`, `category-repository.ts`, `media-repository.ts`

## Recent Changes (November 11, 2025)

**Comprehensive Documentation Package:**
- Created `docs/` folder with complete documentation for AI agents and developers
- **AI_AGENT_GUIDE.md** - Essential guide for AI agents (must read first)
- **ARCHITECTURE.md** - Technical architecture and design decisions
- **RBAC_AND_SECURITY.md** - Complete role definitions, security features, and future improvements
- **SETUP.md** - Complete environment setup for all platforms
- **DEPENDENCIES.md** - All dependencies with Replit independence clarification
- **GIT_WORKFLOW.md** - Git best practices and version control guidelines
- **README.md** - Documentation index and quick reference
- All docs emphasize: check docs/ folder first, track Git history, Replit-independent

**Docker Containerization:**
- Multi-stage Dockerfile for optimized production builds
- Separate development and production Docker Compose configurations
- Automated database migrations on container startup
- Volume persistence for PostgreSQL data and file uploads
- Health checks for application and database services
- Comprehensive documentation in DOCKER.md
- Git version control already initialized

**RTL & Accessibility Fixes:**
- **Mobile Sidebar RTL**: Sidebar/Sheet now opens from correct side in RTL mode (right side for Arabic)
- **LanguageContext Enhancement**: Added `isRTL` boolean property for programmatic RTL detection
- **FilterChips Accessibility**: Fully localized aria-labels with translated filter names (no English slugs)
- **Translation Correction**: Fixed "superadmin" translation from "مدير عام" (Director General) to "مشرف عام" (General Supervisor)
- **RTL Implementation**: All components use Tailwind logical properties (ms-*, me-*, ps-*, pe-*) and rtl:/ltr: variants
- **Architect Verified**: Complete RTL implementation passed final review with no critical defects

**Comprehensive Arabic Language & RTL Support Implementation:**
- **Full Bilingual Support**: Complete Arabic/English dual-language system across entire application
- **i18n Infrastructure**: React-i18next with language detection, localStorage persistence, and LanguageContext for global state
- **503 Translation Keys**: Comprehensive translations organized in 16 namespaces (navigation, events, calendar, tasks, stakeholders, etc.)
- **Professional Arabic**: All UI text translated to formal Arabic (فصحى) with proper grammar and terminology
- **RTL Layout**: Automatic HTML dir/lang attribute toggling, Tailwind RTL support, bidirectional text rendering
- **Database Schema**: Added Arabic fields to all entities (Events: nameAr/descriptionAr/locationAr/organizersAr, Stakeholders: nameAr, Tasks: titleAr/descriptionAr, Updates: contentAr)
- **Bilingual Forms**: All admin forms include Arabic input fields with RTL text direction
- **Smart Fallback**: UI displays Arabic content when available and language is Arabic, falls back to English gracefully
- **Language Switcher**: Toggle component in header and login page for instant language switching
- **Bilingual Scraper**: Abu Dhabi Media Office scraper now fetches both English and Arabic content with graceful degradation
- **Backward Compatible**: All Arabic fields nullable, existing English-only data preserved
- **Complete Coverage**: All pages translated - Home, Login, Calendar, Events, Tasks, Stakeholders, Communications, Settings, Users, Updates, Reminders

**WhatsApp Session Manager - Critical Race Condition Fixes (November 10, 2025):**
- **Login Mutex Implementation**: Added promise-based mutex to prevent concurrent login/auth operations that corrupt session files
- **Queued Session Cleanup**: Changed clearStaleSession() from fire-and-forget to queued operation with complete cache invalidation
- **Fixed Timeout Layering**: Unified timeout management in getQRCode() to prevent double-kill scenarios and promise resolution races
- **Session Stability Flag**: Added sessionUnstable flag to reject operations during auth errors until fresh authentication succeeds
- **Auth Re-verification**: Added ensureAuthenticated() with retry logic in sendMessage/listChats to detect mid-operation disconnects
- **Cache Invalidation**: Implemented invalidateAllCaches() for consistent cleanup of QR codes, chats, and auth timestamps
- **Fixed Deadlock Bug**: Removed isAuthenticated() call inside getQRCode() while holding mutex, eliminating circular wait condition
- **Optimized Login Wait**: Reduced from 30s to 20s after "Logged in" detection, balancing speed vs reliability
- **Frontend QR Polling Fix**: Disabled automatic refetch on window focus; QR code now fetched only once when user clicks "Login"
- **Session Warmup**: Added automatic session validation on app startup to check if WhatsApp is ready without manual intervention
- **Weekly Scraper Schedule**: Abu Dhabi events scraper now runs on 7-day schedule instead of every app restart
- **Architecture**: Non-reentrant mutex with queued operations ensures serial execution, preventing mudslide spawns during session sync
- **Error Handling**: Stale session detection auto-clears cache, comprehensive logging for debugging session lifecycle
- **Session Persistence**: Validated across app restarts with proper mutex coordination and cache management

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Framework:** React 18 with TypeScript, built using Vite.
- **Styling:** shadcn/ui (New York style), Radix UI primitives, Tailwind CSS with custom design tokens.
- **Responsiveness:** Mobile-first design approach optimized for phones (375px+), tablets (640px+), and desktops (1024px+).
- **Branding:** Compact ECSSR globe logo (48x48px square) in admin sidebar, full ECSSR logo on public pages. Theme colors (#BC9F6D, #34A3DC, #9a9595), Montserrat and Open Sans fonts.
- **UI Polish (January 2025):** Professional spacing (p-6 for page containers, p-4 for cards), consistent typography hierarchy (text-2xl md:text-3xl for headings, text-sm font-medium for labels), hover-elevate effects on interactive elements, responsive grid layouts.

### Technical Implementations
- **Frontend State Management:** TanStack Query for server state, React Hook Form with Zod for form validation.
- **Routing:** Wouter for client-side navigation.
- **Event Display:** Side-by-side calendar and event list with interactive bidirectional hover.
- **Calendar Views:** Monthly, Quarterly, Bi-Annually, Yearly with intelligent navigation.
- **Multi-day Events:** Connected event bars with intelligent row placement and consistent coloring. Event names visible in every month they span.
- **Calendar Overflow:** Clickable "+X more" popover on calendar cells showing 3+ events (desktop) or 2+ events (mobile) with full event list and color-coded entries.
- **CSV Export:** Functionality to export event data.
- **Event Details:** Modal for detailed event information.
- **Advanced Filtering (November 2025):**
    - Tabbed filter panel with Category, Event Type, and Scope checkboxes.
    - Dismissible filter chips showing active filters.
    - URL persistence for shareable filtered views.
    - Inspired by Abu Dhabi Media Office design.
- **Task Management:** 
    - Stakeholders can view assigned tasks, update status, add comments with file attachments.
    - File upload system supports images (jpg/png/gif/webp), documents (pdf), and archives (zip) up to 10MB.
    - Task comments display with attachment download functionality.
    - Global file upload toggle in Settings (superadmin only).
- **Unified Admin Interface (November 2025):**
    - Consolidated event management directly on home page.
    - Role-aware UI: admin actions visible only to authenticated admin/superadmin users.
    - Admin action bar with Add Event, CSV Import, Bulk Delete (superadmin only).
    - Edit/delete buttons on individual events for admins.
    - 18rem sidebar navigation with compact ECSSR globe logo, organized into logical sections: Events Calendar, Tasks, Communications, Stakeholders, Reminders, Updates, Users (superadmin only), Settings.
    - CRUD operations for events accessible directly from home page.
    - CSV import with validation error reporting.
    - Public CSV export toggle (superadmin only).
    - Dedicated Communications page for WhatsApp and Email configuration.
    - User creation with role selection (superadmin only).
    - Dedicated Reminders and Stakeholders management.
    - Multi-tier email notification system for stakeholders, reminders, and management summaries with configurable CC lists and provider abstraction (Resend/SMTP).
- **Updates Management (November 2025):**
    - Weekly and monthly organizational updates with tabbed interface.
    - Rich text editing with ReactQuill: bold, italic, underline, headers (H1-H3), ordered/bullet lists.
    - HTML content storage and proper rendering in history view.
    - Copy to clipboard functionality for each update.
    - Period navigation with Previous/Next/Latest buttons.
    - Historical viewing of past updates with preserved formatting.
    - Unsaved changes protection prevents data loss during navigation.
    - Future navigation blocking (admins can only view current and past periods).
    - Date-aware navigation with proper ISO week (Monday start) and month handling.

### System Design Choices
- **Backend Framework:** Express.js with TypeScript.
- **API Design:** RESTful API for event management.
- **Authentication & Authorization:**
    - Passport.js local strategy with scrypt password hashing.
    - Express-session with PostgreSQL store and HTTP-only cookies.
    - Role-Based Access Control (RBAC) with 'Superadmin', 'Admin', and 'Stakeholder' roles.
    - Superadmin default bootstrapping from environment variables and lockout prevention.
    - Protected API routes with role-based middleware (`isAuthenticated`, `isSuperAdmin`, `isAdminOrSuperAdmin`).
    - No public registration.
    - **Comprehensive Access Controls:**
        - **Superadmin**: Full system access (user management, settings, all admin features).
        - **Admin**: Event CRUD, stakeholder assignment, task creation/deletion, reminder management, WhatsApp configuration.
        - **Stakeholder**: View assigned events, update task status, add task comments, access personal dashboard only.
    - **Frontend Protection:** Role-based navigation, admin page redirect for stakeholders.
    - **Backend Protection:** All admin-only endpoints use `isAdminOrSuperAdmin` middleware, stakeholder endpoints use fine-grained access checks.
- **Validation:** Zod schemas for runtime type validation, shared across frontend and backend.
- **Data Storage:**
    - PostgreSQL database using Drizzle ORM.
    - Repository pattern for data access.
    - Tables: `Events`, `Users`, `Sessions`, `Settings`, `ReminderQueue`, `Stakeholders`, `StakeholderEmails`, `StakeholderRequirements`, `EventStakeholders`, `StakeholderAccounts`, `Updates`.
- **Automated Reminders:**
    - WhatsApp and Email reminder scheduling system (1 week/1 day before event) at 8:00 AM GST.
    - Background scheduler service with retry logic.
    - Integration with event CRUD for automatic reminder management.
- **Stakeholder Management:**
    - Superadmin configurable stakeholders with multiple emails and requirement templates.
    - Event-specific stakeholder assignment with selection of predefined and custom requirements.
    - Enhanced email customization with `{{requirements}}` template variable, customizable requirements titles, styling, footer customization, and stakeholder-specific CC lists.
    - Support for multiple user accounts per stakeholder, enabling department-level access and data isolation.
- **WhatsApp Integration:** Automatic initialization and connection management with notification queuing, status monitoring, and reset/logout functionality to clear credentials and reconnect different accounts.
- **Docker Deployment:**
    - Multi-stage build (builder + runtime) for lean production containers.
    - Separate configurations for development (hot reload with bind mounts) and production.
    - Automated database migrations via dedicated service.
    - PostgreSQL 16 with persistent volumes.
    - File uploads stored in Docker volumes.
    - Environment-based configuration via .env files.
    - Health checks for service monitoring.

## External Dependencies

### Third-Party Services
- **Neon Database:** Serverless PostgreSQL hosting.
- **Google Fonts:** Montserrat, Open Sans.
- **Resend:** Transactional email delivery service.

### Key NPM Packages
- **Database & ORM:** `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`
- **Frontend:** `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, `wouter`, `react-quill`
- **UI Components & Styling:** `@radix-ui/*`, `tailwindcss`, `lucide-react`
- **CSV Processing:** `papaparse`
- **Authentication:** `passport`, `express-session`, `connect-pg-simple`, `scrypt`
- **Messaging:** `mudslide` (WhatsApp via Baileys)
- **Email:** `resend`, `nodemailer`