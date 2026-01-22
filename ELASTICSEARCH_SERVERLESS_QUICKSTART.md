# Elasticsearch Serverless - Quick Start

## ⚡ Setup in 3 Minutes

### 1. Get Your Credentials
```
1. Visit: https://cloud.elastic.co/
2. Create → New Project → Elasticsearch Serverless
3. Copy your Cloud ID and API Key
```

### 2. Update `.env.production`
```env
# Serverless Configuration
ELASTICSEARCH_CLOUD_ID=deployment-name:dXMtY2VudHJhbDEuZ2NwLmNsb3VkLmVzLmlvJGQ...
ELASTICSEARCH_API_KEY=VnVxbkFwSUI1dXRqeF9QUXVhRUQ6dmFiYWl4...

# Common Config
ELASTICSEARCH_ENABLED=true
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod

# Comment out (not needed for serverless):
# ELASTICSEARCH_URL=
# ELASTICSEARCH_USERNAME=
# ELASTICSEARCH_PASSWORD=
```

### 3. Update `docker-compose.yml`
```yaml
server:
  depends_on:
    db:
      condition: service_healthy
    migrate:
      condition: service_completed_successfully
    keycloak:
      condition: service_started
    # ❌ Remove this:
    # elasticsearch:
    #   condition: service_healthy
```

Comment out elasticsearch and kibana services:
```yaml
# Comment these out when using Serverless:
# elasticsearch:
#   ...
# kibana:
#   ...
```

### 4. Deploy
```bash
docker compose down
docker compose up -d
```

## ✅ Verify

Check health endpoint:
```bash
curl https://your-domain.com/api/health
```

Test search:
```bash
curl -X POST https://your-domain.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "types": ["events"]}'
```

---

## 🔄 Switch Between Modes

### To Serverless:
```env
ELASTICSEARCH_CLOUD_ID=your-cloud-id
ELASTICSEARCH_API_KEY=your-api-key
```

### To Traditional:
```env
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=password
```

**No code changes needed** - auto-detects based on config!

---

## 📊 What Works Differently

| Feature | Traditional | Serverless |
|---------|-------------|------------|
| **Connection** | URL + Auth | Cloud ID + API Key |
| **Health Check** | `cluster.health()` | `ping()` |
| **Stats** | `cat.indices()` | `indices.stats()` |
| **Kibana** | Self-hosted | Cloud Console |
| **Cluster Mgmt** | Full control | Managed |

**Your app code stays the same** - EventVue handles the differences!

---

## 💡 Pro Tips

1. **Security**: Store API keys in secrets manager (AWS Secrets, Azure Key Vault)
2. **Monitoring**: Use Elastic Cloud console for metrics and alerts
3. **Cost**: Serverless scales automatically - no over-provisioning
4. **Performance**: Choose region closest to your users
5. **Backup**: Serverless handles snapshots automatically

---

## 🐛 Common Issues

### "Connection refused"
- ✅ Check Cloud ID format (must include `:`)
- ✅ Verify API Key is active
- ✅ Ensure no firewall blocking Elastic Cloud

### "Insufficient permissions"
- ✅ API Key needs `manage`, `read`, `write` permissions
- ✅ Regenerate key in Elastic Cloud console

### "Indices not created"
- ✅ Wait 30-60 seconds on first startup
- ✅ Check logs: `docker compose logs server | grep ES`
- ✅ Manually trigger: `POST /api/admin/elasticsearch/reindex`

---

## 📚 Full Documentation

See [ELASTICSEARCH_SERVERLESS.md](./ELASTICSEARCH_SERVERLESS.md) for complete guide.
