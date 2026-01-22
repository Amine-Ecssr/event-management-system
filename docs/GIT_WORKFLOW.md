# Git Workflow Guide

This document outlines the Git workflow and version control practices for the ECSSR Events Calendar project.

## Repository Setup

Git is already initialized for this project. If you're setting up a new clone:

```bash
# Clone repository
git clone <repository-url>
cd <repository-directory>

# Configure user (first time)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

## Branch Strategy

### Main Branch

- **main** (or **master**) - Production-ready code
- Always deployable
- Protected branch (requires review in team settings)

### Feature Development

**For small changes (single session):**
```bash
# Work directly on main for minor fixes
git add .
git commit -m "fix: description"
git push origin main
```

**For larger features:**
```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git add .
git commit -m "feat: description"

# Push to remote
git push origin feature/feature-name

# Merge back to main when complete
git checkout main
git merge feature/feature-name
git push origin main
```

## Commit Message Convention

Follow **Conventional Commits** specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add WhatsApp notification system` |
| `fix` | Bug fix | `fix: correct event date validation` |
| `docs` | Documentation only | `docs: update API documentation` |
| `style` | Code style changes (formatting) | `style: format with prettier` |
| `refactor` | Code refactoring | `refactor: simplify storage layer` |
| `perf` | Performance improvement | `perf: optimize event query` |
| `test` | Adding tests | `test: add event CRUD tests` |
| `chore` | Build/tooling changes | `chore: update dependencies` |
| `build` | Build system changes | `build: configure Docker` |
| `ci` | CI/CD changes | `ci: add GitHub Actions` |

### Scope (Optional)

Indicates what part of the codebase:
- `frontend` - Frontend changes
- `backend` - Backend changes
- `db` - Database schema
- `api` - API routes
- `auth` - Authentication
- `ui` - UI components
- `docs` - Documentation

### Subject

- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

### Examples

**Good commits:**
```bash
git commit -m "feat(api): add event filtering endpoint"
git commit -m "fix(auth): prevent session timeout on active users"
git commit -m "docs: update Docker deployment guide"
git commit -m "refactor(frontend): simplify calendar rendering logic"
```

**Bad commits:**
```bash
git commit -m "Fixed stuff"  # Too vague
git commit -m "WIP"  # Work in progress commits should be squashed
git commit -m "Updated files."  # Not descriptive
```

### Multi-line Commits

For complex changes:

```bash
git commit -m "feat(reminders): add WhatsApp notification system

- Integrate Baileys library for WhatsApp
- Add QR code authentication flow  
- Implement message queuing
- Add session persistence

Closes #123"
```

## Daily Workflow

### 1. Start of Day

```bash
# Pull latest changes
git pull origin main

# Check status
git status

# Check if dependencies updated
git diff HEAD@{1} package.json package-lock.json

# Install if needed
npm install
```

### 2. During Development

```bash
# Check what changed
git status
git diff

# Stage specific files
git add path/to/file

# Or stage all changes
git add .

# Commit with descriptive message
git commit -m "feat(tasks): add file attachment support"

# Push to remote
git push origin main
```

### 3. End of Day

```bash
# Make sure everything is committed
git status

# Push any remaining commits
git push origin main
```

## Common Git Commands

### Viewing History

```bash
# View commit history
git log

# Compact history
git log --oneline

# With graph
git log --oneline --graph

# Last 10 commits
git log --oneline -10

# History for specific file
git log --oneline -- path/to/file

# Search commits by message
git log --grep="keyword"

# Search commits by author
git log --author="name"

# View changes in commit
git show <commit-hash>
```

### Checking Changes

```bash
# See unstaged changes
git diff

# See staged changes
git diff --cached

# See changes in specific file
git diff path/to/file

# See what changed between commits
git diff commit1 commit2
```

### Staging Changes

```bash
# Stage specific file
git add path/to/file

# Stage all changes
git add .

# Stage parts of file interactively
git add -p

# Unstage file
git reset path/to/file

# Unstage all
git reset
```

### Committing

```bash
# Commit staged changes
git commit -m "message"

# Commit all tracked changes (skip staging)
git commit -am "message"

# Amend last commit (change message)
git commit --amend -m "new message"

# Amend last commit (add files)
git add forgotten-file
git commit --amend --no-edit
```

### Branching

```bash
# List branches
git branch

# Create branch
git branch feature-name

# Switch to branch
git checkout feature-name

# Create and switch (one command)
git checkout -b feature-name

# Delete branch
git branch -d feature-name

# Force delete unmerged branch
git branch -D feature-name
```

### Merging

```bash
# Merge feature into current branch
git merge feature-name

# Abort merge if conflicts
git merge --abort
```

### Undoing Changes

```bash
# Discard changes in working directory
git checkout -- path/to/file

# Discard all changes
git checkout -- .

# Undo last commit (keep changes)
git reset HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert <commit-hash>
```

### Stashing

```bash
# Save work in progress
git stash

# List stashes
git stash list

# Apply latest stash
git stash apply

# Apply and remove latest stash
git stash pop

# Stash with message
git stash save "WIP: feature description"
```

## Handling Merge Conflicts

When conflicts occur:

```bash
# 1. Pull latest changes
git pull origin main
# Conflict occurs

# 2. View conflicted files
git status

# 3. Open files and resolve conflicts
# Look for markers:
# <<<<<<< HEAD
# Your changes
# =======
# Their changes
# >>>>>>> commit-hash

# 4. After resolving
git add resolved-file

# 5. Complete merge
git commit -m "merge: resolve conflicts with main"

# 6. Push
git push origin main
```

## Best Practices

### Do's ✅

1. **Commit often** - Small, focused commits are better
2. **Write clear messages** - Follow conventional commits
3. **Pull before push** - Avoid conflicts
4. **Review changes** - Use `git diff` before committing
5. **Keep commits atomic** - One logical change per commit
6. **Update documentation** - When making changes
7. **Test before commit** - Ensure code works

### Don'ts ❌

1. **Don't commit secrets** - Use `.env` (in `.gitignore`)
2. **Don't commit generated files** - Build artifacts, node_modules
3. **Don't commit large files** - Use `.gitignore` or Git LFS
4. **Don't rewrite public history** - No force push to main
5. **Don't commit commented code** - Delete it (it's in Git history)
6. **Don't commit WIP** - Finish feature or use stash

## Working with Documentation

### When to Update Docs

**Always update when:**
- Adding new features → Update `replit.md` Recent Changes
- Changing architecture → Update `docs/ARCHITECTURE.md`
- Adding dependencies → Update `docs/DEPENDENCIES.md`
- Changing setup → Update `docs/SETUP.md`
- Changing workflow → Update `docs/GIT_WORKFLOW.md`

**Documentation commit pattern:**
```bash
# Make code changes
git add src/

# Update docs
git add docs/ replit.md

# Commit together
git commit -m "feat(tasks): add comment attachments

Updated documentation to reflect new file upload system"
```

## .gitignore

The project includes a `.gitignore` file that excludes:

```
# Dependencies
node_modules/

# Build output
dist/
.vite/

# Environment files
.env
.env.local
.env.production
.env.development

# Uploads
uploads/

# Logs
*.log
logs/

# IDE
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Database
*.db
*.sqlite

# WhatsApp session
whatsapp-session/
```

**Never commit:**
- Secrets or API keys
- Database files
- User uploads
- node_modules
- Build artifacts
- IDE settings (unless team agreed)

## Checking What's Ignored

```bash
# Check if file is ignored
git check-ignore -v path/to/file

# List all ignored files
git status --ignored

# Force add ignored file (not recommended)
git add -f path/to/file
```

## Tags and Releases

### Creating Tags

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tag to remote
git push origin v1.0.0

# Push all tags
git push origin --tags

# List tags
git tag

# Delete tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

### Version Numbering

Follow **Semantic Versioning** (MAJOR.MINOR.PATCH):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes

Examples:
- `v1.0.0` - First stable release
- `v1.1.0` - Added new feature
- `v1.1.1` - Bug fix
- `v2.0.0` - Breaking changes

## Collaboration Workflow

### Solo Development

```bash
# Simple workflow
git add .
git commit -m "feat: description"
git push origin main
```

### Team Development

```bash
# 1. Create feature branch
git checkout -b feature/name

# 2. Develop and commit
git add .
git commit -m "feat: description"

# 3. Keep updated with main
git checkout main
git pull origin main
git checkout feature/name
git merge main

# 4. Push feature branch
git push origin feature/name

# 5. Create Pull Request (on GitHub/GitLab)

# 6. After review and merge
git checkout main
git pull origin main
git branch -d feature/name
```

## Emergency Procedures

### Accidentally Committed Secrets

```bash
# 1. Remove from working directory
echo "SECRET_KEY=xyz" >> .env

# 2. Update .gitignore
echo ".env" >> .gitignore

# 3. Remove from Git history (careful!)
git rm --cached .env
git commit -m "chore: remove secrets from git"

# 4. Change the secret immediately!
```

### Messed Up Working Directory

```bash
# Discard all changes (careful!)
git reset --hard HEAD

# Or stash changes
git stash
```

### Need to Undo Last Commit

```bash
# Keep changes (undo commit only)
git reset HEAD~1

# Discard changes too
git reset --hard HEAD~1
```

## Git Aliases (Optional)

Add to `~/.gitconfig`:

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = log --oneline --graph --decorate --all
```

Usage:
```bash
git st  # instead of git status
git co main  # instead of git checkout main
git visual  # pretty graph
```

## Resources

**Git Documentation:**
- Official Guide: https://git-scm.com/doc
- Pro Git Book: https://git-scm.com/book

**Conventional Commits:**
- Specification: https://www.conventionalcommits.org/

**Interactive Learning:**
- Learn Git Branching: https://learngitbranching.js.org/

## Quick Reference

```bash
# Essential commands
git status              # Check status
git add .               # Stage all changes
git commit -m "msg"     # Commit with message
git push origin main    # Push to remote
git pull origin main    # Pull from remote
git log --oneline       # View history

# Branching
git checkout -b name    # Create and switch branch
git merge name          # Merge branch
git branch -d name      # Delete branch

# Undoing
git reset HEAD~1        # Undo last commit (keep changes)
git checkout -- .       # Discard all changes
git stash              # Save WIP

# Viewing
git diff               # See changes
git log -- file        # File history
git show commit        # View commit
```

---

**Remember:** Git is your safety net. Commit often, write clear messages, and always check `git status` before and after operations.
