#!/bin/bash
set -e

echo "🚀 Regenerating Migrations from Scratch"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check DATABASE_URL
echo "📋 Step 1: Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo "Setting default for Docker database..."
    export DATABASE_URL="postgresql://postgres:ecssr@localhost:5432/ecssr_ems_dev"
    echo "DATABASE_URL=$DATABASE_URL"
fi
echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
echo ""

# Step 2: Ensure database is running
echo "📋 Step 2: Starting database..."
if command -v docker-compose &> /dev/null || command -v docker compose &> /dev/null; then
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose -f docker-compose.dev.yml"
    else
        DOCKER_COMPOSE="docker-compose -f docker-compose.dev.yml"
    fi
    
    $DOCKER_COMPOSE up -d db
    echo "Waiting for database to be ready..."
    sleep 10
    echo -e "${GREEN}✅ Database is running${NC}"
else
    echo -e "${YELLOW}⚠️  Docker Compose not found. Make sure PostgreSQL is running.${NC}"
fi
echo ""

# Step 3: Delete old migrations
echo "📋 Step 3: Cleaning old migrations..."
if [ -d "migrations" ]; then
    echo "Backing up old migrations to migrations.backup..."
    mv migrations migrations.backup.$(date +%Y%m%d_%H%M%S)
fi
mkdir -p migrations
echo -e "${GREEN}✅ Migrations folder ready${NC}"
echo ""

# Step 4: Generate fresh migrations
echo "📋 Step 4: Generating migrations from schema..."
export NODE_ENV=development
npx drizzle-kit generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations generated successfully${NC}"
else
    echo -e "${RED}❌ Failed to generate migrations${NC}"
    exit 1
fi
echo ""

# Step 5: Check for seed file
echo "📋 Step 5: Checking for seed file..."
SEED_FILE="migrations/0001_seed_permissions.sql"

if [ ! -f "$SEED_FILE" ]; then
    echo -e "${YELLOW}⚠️  Seed file not found${NC}"
    echo "Creating $SEED_FILE..."
    
    # Check if we have the seed file in outputs
    if [ -f "0001_seed_permissions.sql" ]; then
        cp 0001_seed_permissions.sql "$SEED_FILE"
        echo -e "${GREEN}✅ Copied seed file from current directory${NC}"
    else
        echo -e "${YELLOW}⚠️  Please download 0001_seed_permissions.sql and place it in migrations/ folder${NC}"
        echo "You can continue without it, but you'll need to seed permissions manually."
    fi
else
    echo -e "${GREEN}✅ Seed file found${NC}"
fi
echo ""

# Step 6: List generated files
echo "📋 Step 6: Generated files:"
echo "---"
ls -lh migrations/
echo "---"
echo ""

# Step 7: Apply migrations locally
echo "📋 Step 7: Applying migrations to local database..."
read -p "Apply migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run db:migrate
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migrations applied successfully${NC}"
    else
        echo -e "${RED}❌ Failed to apply migrations${NC}"
        echo "You can try manually:"
        echo "  psql \$DATABASE_URL -f migrations/0000_*.sql"
        echo "  psql \$DATABASE_URL -f migrations/0001_*.sql"
    fi
else
    echo "Skipped. You can apply them later with: npm run db:migrate"
fi
echo ""

# Step 8: Verify
echo "📋 Step 8: Verification..."
read -p "Verify database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Checking permissions table..."
    psql $DATABASE_URL -c "SELECT COUNT(*) as permission_count FROM permissions;" || echo "Table might not exist yet"
    
    echo ""
    echo "Checking role permissions..."
    psql $DATABASE_URL -c "SELECT role, COUNT(*) as count FROM role_permissions GROUP BY role ORDER BY role;" || echo "Table might not exist yet"
fi
echo ""

# Step 9: Summary
echo "========================================="
echo "✅ Migration Setup Complete!"
echo "========================================="
echo ""
echo "📁 Files created:"
echo "  - migrations/_meta/*.json"
echo "  - migrations/0000_initial_*.sql"
echo "  - migrations/0001_seed_permissions.sql (if available)"
echo ""
echo "Next steps:"
echo "  1. Review the generated SQL files"
echo "  2. Commit to git: git add migrations/ && git commit -m 'Add migrations'"
echo "  3. Deploy to Docker: docker compose down && docker compose up -d --build"
echo "  4. Check logs: docker compose logs migrate"
echo "  5. Verify: docker exec -it ecssr-events-db psql -U postgres -d ecssr_events -c 'SELECT COUNT(*) FROM permissions;'"
echo ""
echo "🎉 Done!"

