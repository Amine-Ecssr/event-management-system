# EventVue - Documentation Index

Welcome to the comprehensive documentation for EventVue (ECSSR Events Calendar).

## 📚 Documentation Overview

This `docs/` folder contains all essential documentation for developers and AI agents working on this project. **All documentation must be kept up-to-date with code changes.**

---

## 🚨 START HERE - For AI Agents

### Critical Guidelines

1. **Read this folder FIRST** before making any changes
2. **Check Git history** to understand context
3. **Update documentation** when making changes
4. **Follow established patterns** in existing code
5. **Consider all three environments** - dev, prod, and core/edge

### Priority Reading Order

1. **AI_AGENT_GUIDE.md** ← Start here!
2. **ARCHITECTURE.md** ← Technical deep dive
3. **RBAC_AND_SECURITY.md** ← Roles and security
4. **SETUP.md** ← Environment setup
5. **DEPENDENCIES.md** ← Package information
6. **GIT_WORKFLOW.md** ← Version control

---

## 🌍 Three Deployment Environments

| Environment | Files | Use Case |
|-------------|-------|----------|
| **Development** | `docker-compose.dev.yml` + `.env.development` | Local development with hot reload |
| **Production** | `docker-compose.yml` + `.env.production` | Single server with auto SSL |
| **Core + Edge** | `docker-compose.core.yml/edge.yml` + `.env.core/.env.edge` | Enterprise multi-VM with network isolation |

---

## 📖 Documentation Files

### [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)
**Essential reading for all AI agents and developers.**

**Contents:**
- Project overview and technology stack
- File structure explanation
- Development guidelines and best practices
- Common tasks (adding pages, database changes, etc.)
- Testing procedures
- Deployment information
- Documentation update guidelines

**When to read:** Before starting any work on this project.

---

### [AI_FEATURES.md](./AI_FEATURES.md) ⭐ **NEW**
**Complete guide to AI-powered features in EventVue.**

**Contents:**
- AI Chat Assistant (RAG-based chatbot)
- AI Intake Assistant (text-to-form extraction)
- Setup and configuration instructions
- Environment variables reference
- Security and cost monitoring
- Troubleshooting guide
- API endpoints documentation

**When to read:** 
- Setting up AI features
- Configuring OpenAI integration
- Understanding RAG architecture
- Troubleshooting AI issues

---

### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Comprehensive technical architecture documentation.**

**Contents:**
- System architecture diagram
- Technology stack details
- Data flow patterns (frontend ↔ backend)
- Database schema design
- Authentication & authorization
- Service layer (scheduler, WhatsApp, email)
- Frontend component organization
- Security considerations
- Performance optimizations
- Design decisions and rationale

**When to read:** 
- Before making architectural changes
- When adding new features
- To understand system design

---

### [SETUP.md](./SETUP.md)
**Complete environment setup guide for all platforms.**

**Contents:**
- Prerequisites and required software
- Docker setup (recommended)
- Local development setup
- Replit setup
- Environment variables reference
- Email provider configuration
- WhatsApp setup (optional)
- Database setup options
- Troubleshooting common issues

**When to read:**
- Setting up development environment
- Deploying to new environment
- Troubleshooting setup issues

---

### [DEPENDENCIES.md](./DEPENDENCIES.md)
**Comprehensive package dependency documentation.**

**Contents:**
- Production dependencies list
- Development dependencies list
- **Replit-specific dependencies (optional)**
- Alternative packages for each dependency
- Bundle size analysis
- Security considerations
- Update strategy
- Troubleshooting dependency issues

**When to read:**
- Adding new dependencies
- Updating packages
- Understanding Replit independence
- Troubleshooting package issues

---

### [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)
**Git workflow and version control best practices.**

**Contents:**
- Repository setup
- Branch strategy
- Commit message conventions (Conventional Commits)
- Common Git commands
- Handling merge conflicts
- Working with documentation
- Tags and releases
- Emergency procedures

**When to read:**
- Before committing changes
- When collaborating with team
- When unsure about Git workflow

---

### [RBAC_AND_SECURITY.md](./RBAC_AND_SECURITY.md)
**Role-based access control and comprehensive security guide.**

**Contents:**
- Complete role definitions (Superadmin, Admin, Stakeholder)
- Detailed permissions and constraints for each role
- Current security features (authentication, authorization, file uploads, etc.)
- Security limitations and known risks
- Future security improvements (2FA, rate limiting, audit logging, etc.)
- Future feature enhancements
- Production security checklist

**When to read:**
- Before making authorization changes
- When adding new roles or permissions
- Planning security enhancements
- Before production deployment
- Understanding system constraints

---

## 📁 Other Important Documentation

### Root Directory Files

- **[DOCKER.md](../DOCKER.md)** - Docker deployment guide
- **[replit.md](../replit.md)** - Project overview and recent changes
- **[.env.example](../.env.example)** - Environment variable template

---

## 🎯 Quick Reference

### Common Questions

**Q: Where do I start?**  
A: Read `AI_AGENT_GUIDE.md` first.

**Q: How do I set up the project?**  
A: See `SETUP.md` or use Docker (see `DOCKER.md`).

**Q: Does this work outside Replit?**  
A: Yes! See `DEPENDENCIES.md` for details on Replit independence.

**Q: How do I add a new feature?**  
A: Check `AI_AGENT_GUIDE.md` → Common Tasks section.

**Q: What database should I use?**  
A: Any PostgreSQL 14+. See `SETUP.md` for options.

**Q: How do I make Git commits?**  
A: See `GIT_WORKFLOW.md` for conventions.

---

## 🔄 When to Update Documentation

### Always Update When:

| Change Type | Update These Files |
|-------------|-------------------|
| New feature | `replit.md` (Recent Changes) |
| Architecture change | `ARCHITECTURE.md` |
| New role/permission | `RBAC_AND_SECURITY.md` |
| Security feature | `RBAC_AND_SECURITY.md` |
| New dependency | `DEPENDENCIES.md` |
| Setup process change | `SETUP.md` |
| Git workflow change | `GIT_WORKFLOW.md` |
| Docker change | `DOCKER.md` (root) |

### Documentation Commit Pattern

```bash
# Make code changes
git add src/

# Update relevant docs
git add docs/ replit.md

# Commit together
git commit -m "feat(feature): description

Updated documentation to reflect changes"
```

---

## 🛠️ Technology Stack Summary

### Frontend
- React 18 + TypeScript
- Vite 5 (build tool)
- TanStack Query v5 (state management)
- shadcn/ui + Radix UI (components)
- Tailwind CSS (styling)
- Wouter (routing)

### Backend
- Node.js 20 + Express
- TypeScript
- PostgreSQL (Drizzle ORM)
- Passport.js (authentication)

### Services
- Resend or SMTP (email)
- Baileys (WhatsApp - optional)

### Deployment
- Docker (recommended)
- Works on any platform with Node.js + PostgreSQL

---

## 🔗 External Resources

### Official Documentation
- [React](https://react.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Drizzle ORM](https://orm.drizzle.team/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Express](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Learning Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Git Documentation](https://git-scm.com/doc)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 📝 Documentation Maintenance

### Responsibilities

**When making code changes:**
1. Update relevant documentation
2. Update `replit.md` Recent Changes with date
3. Commit docs with code changes
4. Test that docs are accurate

**Documentation review checklist:**
- [ ] All code changes documented
- [ ] Recent Changes updated in `replit.md`
- [ ] Setup instructions still accurate
- [ ] Architecture diagrams reflect current state
- [ ] No outdated information

---

## 🆘 Support

**If you're stuck:**

1. **Check this documentation folder**
   - Most answers are here

2. **Search Git history**
   ```bash
   git log --grep="keyword"
   git log --oneline -- path/to/file
   ```

3. **Review recent changes**
   - See `replit.md` Recent Changes section

4. **Check for similar issues**
   - Git history often has solutions

---

## 🎓 Best Practices

### For AI Agents

✅ **Do:**
- Read documentation before making changes
- Update docs when changing code
- Follow established patterns
- Test changes before committing
- Use descriptive commit messages

❌ **Don't:**
- Skip reading documentation
- Make changes without understanding architecture
- Ignore Git history
- Assume Replit dependency
- Commit without updating docs

### For Developers

✅ **Do:**
- Keep documentation up-to-date
- Write clear commit messages
- Test locally or with Docker
- Review architecture before major changes
- Document design decisions

❌ **Don't:**
- Commit secrets or `.env` files
- Skip testing
- Make breaking changes without team discussion
- Ignore TypeScript errors
- Commit commented-out code

---

## 📊 Project Statistics

**Lines of Code:** ~15,000+ (TypeScript)  
**Files:** 100+  
**Components:** 30+  
**API Endpoints:** 40+  
**Database Tables:** 12+  
**Dependencies:** 90+ packages  
**Required Dependencies:** ~20 core packages

---

## 🗺️ Documentation Roadmap

### Current Status ✅
- [x] AI Agent Guide
- [x] Architecture Documentation
- [x] RBAC & Security Guide
- [x] Setup Guide
- [x] Dependencies Reference
- [x] Git Workflow
- [x] Docker Deployment
- [x] This Index (README)

### Future Enhancements 🚧
- [ ] API Reference (OpenAPI/Swagger)
- [ ] Component Documentation (Storybook)
- [ ] Testing Guide
- [ ] Performance Optimization Guide
- [ ] Security Best Practices
- [ ] Troubleshooting Database

---

## 📜 License & Contributing

This is an internal project for ECSSR. Refer to project maintainers for contribution guidelines.

---

## 🔄 Last Updated

**Date:** December 7, 2025

**See `replit.md` for most recent changes to the application.**

---

**Remember:** This documentation folder is your source of truth. Keep it updated, and it will serve you well!
