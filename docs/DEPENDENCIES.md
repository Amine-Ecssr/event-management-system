# Dependencies Reference

This document provides a comprehensive list of all project dependencies, their purposes, and alternatives.

## 🔴 Critical: Replit Independence

**This project does NOT depend on Replit infrastructure.**

The application includes a few optional Replit development plugins that:
- Only load when `REPL_ID` environment variable exists (Replit-specific)
- Only run in development mode (`NODE_ENV=development`)
- Are completely optional and do not affect functionality
- Can be removed without breaking the application

See [Replit-Specific Dependencies](#replit-specific-dependencies-optional) section below.

---

## Production Dependencies

These packages are required for the application to run.

### Core Framework & Runtime

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `express` | ^4.21.2 | Web application framework | Fastify, Koa, Hapi |
| `react` | ^18.3.1 | UI framework | Vue, Svelte, Angular |
| `react-dom` | ^18.3.1 | React DOM renderer | (none - required with React) |

### Database & ORM

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `drizzle-orm` | ^0.39.1 | TypeScript ORM | Prisma, TypeORM, Kysely |
| `@neondatabase/serverless` | ^0.10.4 | Serverless PostgreSQL driver | `pg`, `postgres` |
| `connect-pg-simple` | ^10.0.0 | PostgreSQL session store | `connect-redis` |

**Note on database:** Can use any PostgreSQL database (local, Neon, Supabase, AWS RDS, etc.). `@neondatabase/serverless` works with standard PostgreSQL too.

### State Management & Data Fetching

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | ^5.60.5 | Server state management | SWR, Apollo Client, RTK Query |

### Routing

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `wouter` | ^3.3.5 | Client-side router | React Router, TanStack Router |

**Why Wouter:** Extremely lightweight (~1KB) vs React Router (~15KB), supports all needed features.

### UI Components & Styling

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `@radix-ui/*` | Various | Unstyled accessible primitives | Headless UI, React Aria |
| `lucide-react` | ^0.453.0 | Icon library | React Icons, Heroicons |
| `tailwindcss` | ^3.4.17 | Utility CSS framework | Bootstrap, Chakra UI |
| `class-variance-authority` | ^0.7.1 | Component variants | (none - utility) |
| `tailwind-merge` | ^2.6.0 | Tailwind class merging | `clsx` alone |
| `clsx` | ^2.1.1 | Conditional class names | `classnames` |
| `tailwindcss-animate` | ^1.0.7 | Tailwind animations | Framer Motion |
| `next-themes` | ^0.4.6 | Theme switching | Custom implementation |

### Forms & Validation

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `react-hook-form` | ^7.55.0 | Form state management | Formik, React Final Form |
| `zod` | ^3.24.2 | Schema validation | Yup, Joi, io-ts |
| `@hookform/resolvers` | ^3.10.0 | Form + Zod integration | (none - glue package) |
| `drizzle-zod` | ^0.7.0 | Drizzle + Zod integration | (none - generates schemas) |
| `zod-validation-error` | ^3.4.0 | Friendly Zod errors | (none - utility) |

### Authentication & Session

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `passport` | ^0.7.0 | Authentication middleware | Custom implementation |
| `passport-local` | ^1.0.0 | Username/password strategy | `passport-jwt`, OAuth strategies |
| `express-session` | ^1.18.1 | Session management | JWT, Custom sessions |
| `memorystore` | ^1.6.7 | Development session store | (dev only) |

**Note:** Production uses PostgreSQL session store (`connect-pg-simple`), not memorystore.

### Date & Time

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `date-fns` | ^3.6.0 | Date manipulation | Moment.js, Day.js, Luxon |

**Why date-fns:** Tree-shakeable, immutable, functional, no locale bloat.

### Messaging & Email

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `@whiskeysockets/baileys` | ^6.x | WhatsApp Web API | `whatsapp-web.js` |
| `resend` | ^6.4.1 | Email service (Resend) | (optional - see SMTP) |
| `nodemailer` | ^7.0.10 | Email service (SMTP) | `@sendgrid/mail`, AWS SES SDK |
| `ws` | ^8.18.0 | WebSocket (for WhatsApp) | (none - required by Baileys) |

**Email setup:** Use either Resend OR SMTP (not both). See `docs/SETUP.md`.

### Data Processing

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `papaparse` | ^5.5.3 | CSV parsing | `csv-parser`, `fast-csv` |
| `cheerio` | ^1.1.2 | HTML parsing (scraper) | `jsdom`, `node-html-parser` |

### Rich Text Editor

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `react-quill` | ^2.0.0 | WYSIWYG editor | Draft.js, Slate, TipTap |

### File Handling

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `multer` | ^2.0.2 | File upload handling | `formidable`, `busboy` |

### Utilities

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `memoizee` | ^0.4.17 | Function memoization | `lodash.memoize` |
| `openid-client` | ^6.8.1 | OAuth/OIDC (if using Replit auth) | `passport-oauth2` |

### UI Enhancement

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `framer-motion` | ^11.13.1 | Animations | `react-spring`, CSS animations |
| `embla-carousel-react` | ^8.6.0 | Carousel component | `swiper`, `react-slick` |
| `vaul` | ^1.1.2 | Drawer component | Radix Dialog |
| `cmdk` | ^1.1.1 | Command palette | `kbar` |
| `react-day-picker` | ^8.10.1 | Date picker | `react-datepicker` |
| `react-resizable-panels` | ^2.1.7 | Resizable panels | `react-split` |
| `recharts` | ^2.15.2 | Charts (if used) | Chart.js, Victory |
| `input-otp` | ^1.4.2 | OTP input | Custom input |
| `react-icons` | ^5.4.0 | Icon library | Lucide (already included) |

---

## Development Dependencies

These packages are only needed during development.

### TypeScript & Type Definitions

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.6.3 | TypeScript compiler |
| `@types/node` | 20.16.11 | Node.js types |
| `@types/react` | ^18.3.11 | React types |
| `@types/react-dom` | ^18.3.1 | React DOM types |
| `@types/express` | 4.17.21 | Express types |
| `@types/express-session` | ^1.18.0 | Express session types |
| `@types/passport` | ^1.0.16 | Passport types |
| `@types/passport-local` | ^1.0.38 | Passport local types |
| `@types/connect-pg-simple` | ^7.0.3 | Session store types |
| `@types/multer` | ^2.0.0 | Multer types |
| `@types/nodemailer` | ^7.0.3 | Nodemailer types |
| `@types/papaparse` | ^5.3.16 | PapaParse types |
| `@types/cheerio` | ^0.22.35 | Cheerio types |
| `@types/memoizee` | ^0.4.12 | Memoizee types |
| `@types/ws` | ^8.5.13 | WebSocket types |

### Build Tools

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| `vite` | ^5.4.20 | Frontend build tool | Webpack, esbuild, Rollup |
| `@vitejs/plugin-react` | ^4.7.0 | React plugin for Vite | (none - required) |
| `esbuild` | ^0.25.0 | Backend bundler | SWC, Webpack |
| `tsx` | ^4.20.5 | TypeScript execution | `ts-node`, `ts-node-dev` |

**Why Vite:** Fast HMR, modern build tool, excellent DX.

### CSS & Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `postcss` | ^8.4.47 | CSS processor |
| `autoprefixer` | ^10.4.20 | Vendor prefixes |
| `@tailwindcss/vite` | ^4.1.3 | Tailwind Vite plugin |
| `@tailwindcss/typography` | ^0.5.15 | Typography plugin |

### Database

| Package | Version | Purpose |
|---------|---------|---------|
| `drizzle-kit` | ^0.31.4 | Drizzle CLI |

---

## Replit-Specific Dependencies (Optional)

These packages are **OPTIONAL** and only enhance development experience in Replit.

| Package | Version | Purpose | When It Loads |
|---------|---------|---------|---------------|
| `@replit/vite-plugin-cartographer` | ^0.4.0 | Code navigation tool | `REPL_ID` exists + dev mode |
| `@replit/vite-plugin-dev-banner` | ^0.1.1 | Dev mode banner | `REPL_ID` exists + dev mode |
| `@replit/vite-plugin-runtime-error-modal` | ^0.0.3 | Error modal overlay | Always in dev (harmless) |

### How They're Used

In `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),  // Always loads (harmless)
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined  // Only in Replit dev
      ? [
          await import("@replit/vite-plugin-cartographer").then(m => m.cartographer()),
          await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()),
        ]
      : []),
  ],
  // ...
});
```

### Removing Replit Plugins

To completely remove Replit dependencies:

1. **Uninstall packages:**
   ```bash
   npm uninstall @replit/vite-plugin-cartographer \
                 @replit/vite-plugin-dev-banner \
                 @replit/vite-plugin-runtime-error-modal
   ```

2. **Update vite.config.ts:**
   ```typescript
   export default defineConfig({
     plugins: [
       react(),
       // Removed Replit plugins
     ],
     // ... rest of config
   });
   ```

3. **Application works exactly the same!**

### Why Include Them?

- Enhance development experience in Replit
- Zero impact on production
- Zero impact outside Replit
- Can be removed anytime without breaking anything

---

## Optional Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `bufferutil` | ^4.0.8 | WebSocket performance optimization |

Optional dependencies install if platform supports them, otherwise gracefully skipped.

---

## Dependency Analysis

### Bundle Size Impact (Frontend)

**Largest contributors:**
1. React + React DOM (~130KB gzipped)
2. Radix UI components (~80KB total gzipped)
3. TanStack Query (~15KB gzipped)
4. Tailwind CSS (variable, unused purged)
5. React Hook Form (~10KB gzipped)

**Optimization strategies:**
- Code splitting by route (Vite automatic)
- Tree shaking (Vite automatic)
- Tailwind purging (configured)
- Dynamic imports for heavy components

### Security Considerations

**Regular updates needed:**
- `express` - Web framework security
- `passport` - Authentication security
- Database drivers - SQL injection prevention
- Validation libraries - Input sanitization

**Check for vulnerabilities:**
```bash
npm audit
npm audit fix
```

---

## Alternative Dependency Stacks

### Minimal Stack (If Rebuilding)

**Frontend:**
- React + TypeScript
- TanStack Query
- Wouter or React Router
- Tailwind CSS
- React Hook Form + Zod

**Backend:**
- Express + TypeScript
- Drizzle ORM + PostgreSQL
- Passport.js
- Nodemailer (SMTP)

**Total:** ~20 packages instead of 90+

### Full-Featured Alternative Stack

**Frontend:**
- Next.js (instead of React + Vite)
- React Query (same)
- Chakra UI (instead of shadcn/ui)
- React Hook Form + Yup

**Backend:**
- Next.js API routes (instead of Express)
- Prisma (instead of Drizzle)
- NextAuth.js (instead of Passport)
- SendGrid (instead of Resend/Nodemailer)

---

## Dependency Update Strategy

### Semantic Versioning

Versions use `^` (caret) or `~` (tilde):
- `^1.2.3` - Compatible with 1.x.x (recommended)
- `~1.2.3` - Compatible with 1.2.x (strict)
- `1.2.3` - Exact version (avoid unless needed)

### Update Process

**Check for updates:**
```bash
npm outdated
```

**Update all (minor/patch):**
```bash
npm update
```

**Update specific package:**
```bash
npm install package-name@latest
```

**Update major versions:**
```bash
# Review changelog first!
npm install package-name@next
```

**After updates:**
```bash
# Test application
npm run dev

# Check for issues
npm run check

# Test build
npm run build
```

### Critical Dependencies to Watch

**Breaking changes likely:**
- React (major updates)
- TanStack Query (v4 → v5 was breaking)
- Drizzle ORM (actively developed)
- Tailwind CSS (v3 → v4 will be breaking)

**Update carefully:**
- Express (stable, rare breaks)
- TypeScript (enable strict mode gradually)
- Vite (usually smooth)

---

## Platform-Specific Notes

### Running on Different Platforms

**Local (macOS/Linux/Windows):**
- All dependencies work
- No Replit plugins load
- Standard Node.js environment

**Docker:**
- All dependencies work
- No Replit plugins load
- Isolated environment

**Replit:**
- All dependencies work
- Replit plugins load in dev mode
- Managed PostgreSQL available

**Cloud (AWS/GCP/Azure):**
- All dependencies work
- No Replit plugins load
- Connect to managed PostgreSQL

---

## Troubleshooting Dependencies

### npm install fails

**Error:** `ERESOLVE unable to resolve dependency tree`

**Solution:**
```bash
npm install --legacy-peer-deps
```

### Missing peer dependencies

**Warning:** `package requires peer X`

**Solution:**
```bash
npm install <peer-package>
```

### Native module compilation fails

**Error:** `node-gyp rebuild failed`

**Solution:**
- Update Node.js to version 20+
- Install build tools (Python, C++ compiler)
- Or use pre-built binaries

### Package conflicts

**Error:** Different packages need different versions

**Solution:**
1. Check if updates available
2. Use `npm ls <package>` to see dependency tree
3. Consider using `overrides` in package.json

---

## Summary

### Core Philosophy

**Minimal necessary dependencies:**
- Prefer lightweight over feature-rich
- Avoid redundancy (one library per purpose)
- Choose maintained packages with active communities

**Type safety first:**
- TypeScript everywhere
- Runtime validation with Zod
- Type inference from database schema

**Replit independent:**
- No hard dependency on Replit services
- Optional dev plugins for better DX
- Runs anywhere Node.js + PostgreSQL available

### Quick Reference

**Essential packages (cannot remove):**
- React, Express, Drizzle ORM, TanStack Query
- Zod, React Hook Form, Passport.js
- Tailwind CSS, Radix UI, date-fns

**Optional packages (can replace/remove):**
- Resend (use SMTP instead)
- Mudslide (disable WhatsApp)
- ReactQuill (use different editor)
- All Replit plugins

**Development only (not in production build):**
- TypeScript, Vite, esbuild, tsx
- All `@types/*` packages
- Drizzle Kit
- Replit plugins

---

For more information about setup and configuration, see:
- `docs/SETUP.md` - Environment setup guide
- `docs/ARCHITECTURE.md` - Technical architecture
- `docs/AI_AGENT_GUIDE.md` - Development guide
