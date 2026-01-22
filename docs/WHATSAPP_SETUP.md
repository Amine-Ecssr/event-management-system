# WhatsApp Integration Setup Guide

Complete guide for setting up and using WhatsApp notifications with Baileys in the ECSSR Events Calendar.

---

## 📋 Overview

The ECSSR Events Calendar uses **Baileys** for WhatsApp integration, providing:
- ✅ **Easy Setup** - No complex initialization required
- ✅ **QR Code Authentication** - Simple scan-and-connect process
- ✅ **Auto-Reconnect** - Handles disconnections automatically
- ✅ **Group Messaging** - Send notifications to WhatsApp groups
- ✅ **Persistent Sessions** - Maintains connection across restarts

---

## 🚀 Quick Start

### 1. Start the Services

```bash
# Using the new microservices architecture
docker-compose -f docker-compose.new.yml up -d
```

### 2. Access WhatsApp Settings

1. Log in as **Superadmin** (default: `admin` / `admin123`)
2. Navigate to **Settings** → **WhatsApp Configuration**
3. Go to the **Connection Management** tab

### 3. Connect WhatsApp

1. Click **"Show QR Code"** button
2. A QR code will appear on the screen
3. Open WhatsApp on your phone:
   - Go to **Settings** → **Linked Devices**
   - Tap **"Link a Device"**
   - Scan the QR code displayed on the screen
4. Wait for connection confirmation (status will update automatically)

### 4. Select Target Group

1. Once connected, click **"Select Group"**
2. Browse your WhatsApp groups
3. Choose the group where notifications should be sent
4. Click the group to select it

### 5. Enable Notifications

1. Toggle **"WhatsApp Notifications"** to ON
2. Click **"Send Test Message"** to verify setup
3. Check your WhatsApp group for the test message

---

## 🏗️ Architecture

### Service Structure

```
EventVue/
├── whatsapp-service/          # Isolated WhatsApp microservice
│   ├── src/
│   │   ├── index.ts           # Express API server
│   │   └── baileys-manager.ts # Baileys WhatsApp client
│   ├── auth_info/             # Session data (persisted)
│   └── Dockerfile
├── server/                    # Main backend
│   ├── whatsapp-client.ts     # HTTP client for WhatsApp service
│   ├── routes.ts              # Central router
│   └── routes/                # API route modules
└── client/
    └── src/pages/
        └── WhatsAppSettings.tsx # Admin UI
```

### Communication Flow

```
Frontend (React)
    ↓ HTTP
Server (Express)
    ↓ HTTP
WhatsApp Service (Port 3001)
    ↓ WebSocket
Baileys Library
    ↓ WhatsApp Protocol
WhatsApp Servers
```

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file or `docker-compose.new.yml`:

```bash
# WhatsApp Service Configuration
WHATSAPP_SERVICE_URL=http://whatsapp-service:3001
WHATSAPP_ENABLED=true
WHATSAPP_AUTH_PHRASE=your-secure-authentication-phrase-here
WHATSAPP_DEFAULT_GROUP=ECSSR Events
```

### Docker Compose Setup

The WhatsApp service is already configured in `docker-compose.new.yml`:

```yaml
whatsapp-service:
  build:
    context: ./whatsapp-service
    dockerfile: Dockerfile
  container_name: ecssr-whatsapp-service
  restart: unless-stopped
  environment:
    NODE_ENV: production
    PORT: 3001
    WHATSAPP_AUTH_PHRASE: ${WHATSAPP_AUTH_PHRASE}
    WHATSAPP_DEFAULT_GROUP: ${WHATSAPP_DEFAULT_GROUP}
  ports:
    - "3001:3001"
  volumes:
    # Persist WhatsApp session data
    - ./whatsapp-service/auth_info:/app/auth_info
  networks:
    - ecssr-network
```

---

## 📡 API Endpoints

### Status Endpoint
```http
GET /api/whatsapp/status
```

**Response:**
```json
{
  "connected": true,
  "qrCode": "base64-qr-code-string", // Only present if not connected
  "phoneNumber": "+1234567890"
}
```

### Groups Endpoint
```http
GET /api/whatsapp/groups
```

**Response:**
```json
{
  "groups": [
    {
      "id": "group-jid@g.us",
      "name": "ECSSR Events",
      "participants": 25
    }
  ]
}
```

### Send Message Endpoint
```http
POST /api/whatsapp/send
```

**Request Body:**
```json
{
  "message": "🎉 New Event Created!\n\nEvent: Annual Conference\n...",
  "groupName": "ECSSR Events",
  "authPhrase": "your-secure-phrase"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "sentTo": "ECSSR Events"
}
```

---

## 🎨 UI Features

### Connection Management Tab

**Status Indicators:**
- 🟢 **Connected** - WhatsApp is authenticated and ready
- 🔴 **Not Connected** - Needs QR code scan
- 🟡 **Checking...** - Loading status

**Features:**
- Real-time connection status
- QR code display for authentication
- Phone number display when connected
- Group selection interface
- Disconnect button
- Enable/disable notifications toggle

### Message Customization Tab

**Template Editor:**
- Event creation templates (English & Arabic)
- Reminder templates (English & Arabic)
- Variable substitution support
- Language selection

**Available Variables:**
- `{{eventName}}` - Event title
- `{{location}}` - Event location
- `{{startDate}}` - Event start date/time
- `{{endDate}}` - Event end date/time
- `{{description}}` - Event description
- `{{stakeholders}}` - Assigned stakeholders

---

## 🔍 Troubleshooting

### QR Code Not Appearing

**Problem:** QR code doesn't show after clicking "Show QR Code"

**Solution:**
1. Check if WhatsApp service is running:
   ```bash
   docker ps | grep whatsapp-service
   ```
2. Check service logs:
   ```bash
   docker logs ecssr-whatsapp-service
   ```
3. Restart the service:
   ```bash
   docker-compose -f docker-compose.new.yml restart whatsapp-service
   ```

### Connection Keeps Dropping

**Problem:** WhatsApp disconnects frequently

**Solutions:**
1. **Check auth_info persistence:**
   ```bash
   ls -la whatsapp-service/auth_info/
   ```
   Ensure the directory has proper permissions and contains session files.

2. **Verify phone is online:**
   - Keep your phone connected to internet
   - Don't logout from WhatsApp on your phone

3. **Check logs for errors:**
   ```bash
   docker logs -f ecssr-whatsapp-service
   ```

### Group Not Found Error

**Problem:** "Group not found" when sending messages

**Solutions:**
1. Verify group name matches exactly (case-sensitive)
2. Re-select the group from the group browser
3. Check if the bot is still a member of the group

### Messages Not Sending

**Problem:** Test message doesn't arrive in group

**Checklist:**
1. ✅ WhatsApp is connected
2. ✅ Group is selected
3. ✅ Notifications are enabled
4. ✅ AUTH_PHRASE is set correctly
5. ✅ Bot phone number is member of the group

**Debug:**
```bash
# Check server logs
docker logs ecssr-events-server

# Check WhatsApp service logs
docker logs ecssr-whatsapp-service

# Test the endpoint directly
curl -X POST http://localhost:3001/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test",
    "groupName": "ECSSR Events",
    "authPhrase": "your-phrase"
  }'
```

---

## 🔒 Security Considerations

### Authentication Phrase

The `WHATSAPP_AUTH_PHRASE` acts as an API key to prevent unauthorized message sending:

```bash
# Generate a secure phrase
openssl rand -base64 32
```

Add it to your `.env`:
```bash
WHATSAPP_AUTH_PHRASE=your-generated-secure-phrase-here
```

### Session Data Protection

- Session data is stored in `whatsapp-service/auth_info/`
- This directory is mounted as a Docker volume
- **DO NOT** commit this directory to git (already in `.gitignore`)
- Back up this directory to preserve your connection

### Network Isolation

- WhatsApp service runs in isolated container
- Only main server can communicate with it
- Uses internal Docker network (ecssr-network)

---

## 📊 Monitoring

### Health Checks

```bash
# Check WhatsApp service health
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "service": "whatsapp-service",
  "timestamp": "2025-11-13T..."
}
```

### Connection Status

```bash
# Check connection status
curl http://localhost:5001/api/whatsapp/status

# Expected response (when connected):
{
  "authenticated": true,
  "connected": true,
  "phoneNumber": "+1234567890"
}
```

### Logs

```bash
# Follow WhatsApp service logs
docker logs -f ecssr-whatsapp-service

# Look for:
# - [Baileys] Connected successfully!
# - [Baileys] QR Code received...
# - [WhatsApp Service] Message sent to group: ...
```

---

## 🔄 Maintenance

### Backing Up Session

```bash
# Create backup
tar -czf whatsapp-session-backup-$(date +%Y%m%d).tar.gz whatsapp-service/auth_info/

# Restore backup
tar -xzf whatsapp-session-backup-YYYYMMDD.tar.gz
docker-compose -f docker-compose.new.yml restart whatsapp-service
```

### Reconnecting After Logout

If you logged out from WhatsApp:

1. Stop the service:
   ```bash
   docker-compose -f docker-compose.new.yml down whatsapp-service
   ```

2. Clear session data:
   ```bash
   rm -rf whatsapp-service/auth_info/*
   ```

3. Restart and reconnect:
   ```bash
   docker-compose -f docker-compose.new.yml up -d whatsapp-service
   ```

4. Scan new QR code from the UI

### Updating WhatsApp Service

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.new.yml build whatsapp-service
docker-compose -f docker-compose.new.yml up -d whatsapp-service
```

---

## 🆘 Support

### Common Commands

```bash
# View all services status
docker-compose -f docker-compose.new.yml ps

# Restart WhatsApp service
docker-compose -f docker-compose.new.yml restart whatsapp-service

# View logs
docker-compose -f docker-compose.new.yml logs -f whatsapp-service

# Access container shell
docker exec -it ecssr-whatsapp-service sh

# Check network connectivity
docker exec ecssr-whatsapp-service ping -c 3 whatsapp-service
```

### Getting Help

If you encounter issues:

1. **Check logs** - Most issues are logged
2. **Verify configuration** - Ensure environment variables are set
3. **Test connectivity** - Ensure containers can communicate
4. **Review this guide** - Follow setup steps carefully

---

## 📚 Additional Resources

- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

## ✅ Checklist

Use this checklist to verify your setup:

- [ ] Docker services are running
- [ ] WhatsApp service is healthy
- [ ] QR code appears in UI
- [ ] WhatsApp is connected
- [ ] Phone number is displayed
- [ ] Can browse groups
- [ ] Group is selected
- [ ] Notifications are enabled
- [ ] Test message sends successfully
- [ ] Session persists after restart

---

**Last Updated:** December 7, 2025  
**Version:** 2.0 (Baileys Microservice Architecture)
