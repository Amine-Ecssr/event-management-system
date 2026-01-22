# Elasticsearch Serverless Setup Guide

EventVue now supports **Elasticsearch Serverless** in addition to traditional self-hosted and Elastic Cloud deployments.

---

## 🌐 Deployment Options

### Option 1: Elasticsearch Serverless (Recommended for Cloud)
**Best for**: Production deployments, auto-scaling, minimal operational overhead

- ✅ Fully managed by Elastic
- ✅ Auto-scaling (no cluster management)
- ✅ Built-in security and monitoring
- ✅ Pay-per-use pricing
- ✅ No infrastructure maintenance

### Option 2: Traditional Elasticsearch
**Best for**: Self-hosted, on-premises, full control

- ✅ Full cluster control
- ✅ Custom configurations
- ✅ Works with local Docker setup
- ✅ Supports older ES versions

---

## 🚀 Serverless Configuration

### Step 1: Create Serverless Project

1. Go to [Elastic Cloud](https://cloud.elastic.co/)
2. Create a new **Serverless** project (not "Elasticsearch Service")
3. Choose your region
4. Save your **Cloud ID** and **API Key**

### Step 2: Configure Environment Variables

Add these to your `.env.production` file:

```env
# Elasticsearch Serverless Configuration
ELASTICSEARCH_CLOUD_ID=your-cloud-id-here
ELASTICSEARCH_API_KEY=your-api-key-here
ELASTICSEARCH_ENABLED=true
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Leave these empty (not used in serverless mode)
ELASTICSEARCH_URL=
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
```

### Step 3: Update Docker Compose

When using serverless, you can comment out the local elasticsearch service in `docker-compose.yml`:

```yaml
services:
  # Comment out elasticsearch and kibana when using serverless
  # elasticsearch:
  #   ...
  # kibana:
  #   ...
  
  server:
    # Remove elasticsearch dependency
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
      keycloak:
        condition: service_started
      # elasticsearch not needed for serverless
```

### Step 4: Deploy

```bash
docker compose up -d
```

The application will automatically connect to your Elasticsearch Serverless instance.

---

## 🔧 Traditional Configuration

For self-hosted or traditional Elastic Cloud deployments:

```env
# Traditional Elasticsearch Configuration
ELASTICSEARCH_URL=https://your-es-instance.com:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your-password
ELASTICSEARCH_ENABLED=true
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Leave these empty (not used in traditional mode)
ELASTICSEARCH_CLOUD_ID=
ELASTICSEARCH_API_KEY=
```

---

## 🎯 Auto-Detection

EventVue automatically detects which mode to use:

- **Serverless Mode**: If `ELASTICSEARCH_CLOUD_ID` and `ELASTICSEARCH_API_KEY` are set
- **Traditional Mode**: If only `ELASTICSEARCH_URL` is set

You can use either configuration without code changes!

---

## 📊 Feature Compatibility

### ✅ Fully Compatible (Both Modes)
- Index creation and management
- Document indexing and search
- Aggregations and analytics
- Arabic text search (ICU analysis)
- Multi-language support
- Bulk operations
- Index lifecycle management

### ⚠️ Serverless Limitations
These APIs are **not available** in Serverless (EventVue handles this automatically):

- `cluster.health()` - Replaced with `ping()`
- `cat.indices()` - Replaced with `indices.stats()`
- Cluster-level operations
- Node management
- Snapshot/restore APIs

EventVue abstracts these differences, so your application works seamlessly in both modes.

---

## 🔍 Verification

### Check Connection Status

Visit the admin panel:
```
https://your-domain.com/admin/elasticsearch
```

You'll see:
- Connection status (green/yellow/red)
- Deployment type (Serverless vs Traditional)
- Index statistics
- Cluster information (if available)

### Test Search

```bash
curl -X POST https://your-domain.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "types": ["events"]}'
```

---

## 💰 Cost Considerations

### Serverless Pricing
- **Compute**: Based on actual query usage
- **Storage**: Per GB stored
- **No idle costs**: Pay only for what you use
- **Auto-scaling**: No over-provisioning needed

### Traditional Pricing
- **Fixed costs**: Pay for provisioned capacity
- **Requires capacity planning**
- **May have idle capacity**
- **Manual scaling required**

**Recommendation**: For most production deployments, Serverless is more cost-effective and easier to manage.

---

## 🔄 Migration Guide

### From Traditional to Serverless

1. **Create Serverless Project** (see Step 1 above)

2. **Export Data** (optional - if you want to migrate existing data):
   ```bash
   # Not implemented yet - indices will be recreated automatically
   # EventVue will re-index all data from PostgreSQL
   ```

3. **Update Environment**:
   ```env
   ELASTICSEARCH_CLOUD_ID=new-cloud-id
   ELASTICSEARCH_API_KEY=new-api-key
   # Remove ELASTICSEARCH_URL, USERNAME, PASSWORD
   ```

4. **Deploy**:
   ```bash
   docker compose down
   docker compose up -d
   ```

5. **Re-index Data**:
   ```bash
   # Visit admin panel or use API
   POST /api/admin/elasticsearch/reindex
   ```

### From Serverless to Traditional

1. **Deploy Elasticsearch** (Docker or self-hosted)

2. **Update Environment**:
   ```env
   ELASTICSEARCH_URL=http://elasticsearch:9200
   ELASTICSEARCH_USERNAME=elastic
   ELASTICSEARCH_PASSWORD=your-password
   # Remove ELASTICSEARCH_CLOUD_ID, ELASTICSEARCH_API_KEY
   ```

3. **Deploy**:
   ```bash
   docker compose up -d
   ```

---

## 🐛 Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to Elasticsearch"

**Solution**:
1. Verify Cloud ID format (should include `:`):
   ```
   deployment-name:base64-encoded-data
   ```

2. Check API Key permissions:
   - Must have `manage` privilege for index creation
   - Must have `write` and `read` for data operations

3. Check logs:
   ```bash
   docker compose logs server | grep ES
   ```

### Index Creation Fails

**Problem**: "Unable to create indices"

**Solution**:
1. Ensure API Key has sufficient permissions
2. Check index naming conflicts
3. Verify ES_INDEX_PREFIX doesn't conflict with existing indices

### Slow Performance

**Problem**: Queries are slower than expected

**Solution**:
1. Check your Serverless project size/region
2. Verify data volume (Serverless scales automatically, but may need time)
3. Review query complexity and use aggregation caching

---

## 📚 Additional Resources

- [Elastic Serverless Documentation](https://www.elastic.co/guide/en/serverless/current/index.html)
- [EventVue Elasticsearch Architecture](./ELASTICSEARCH_ARCHITECTURE.md)
- [Search API Documentation](./ELASTICSEARCH_QUERIES.md)
- [Maintenance Guide](./ELASTICSEARCH_MAINTENANCE.md)

---

## ✅ Checklist

Before deploying with Serverless:

- [ ] Created Elastic Serverless project
- [ ] Saved Cloud ID and API Key securely
- [ ] Updated environment variables
- [ ] Removed elasticsearch service from docker-compose (optional)
- [ ] Tested connection with health check
- [ ] Verified search functionality
- [ ] Set up monitoring/alerts in Elastic Cloud console
