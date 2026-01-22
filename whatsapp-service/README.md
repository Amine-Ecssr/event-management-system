# WhatsApp Service

A standalone microservice for relaying WhatsApp messages. This service maintains a persistent WhatsApp session using Baileys and provides a simple API endpoint for sending messages to groups.

## Features

- 🔐 **Secure**: Password-protected API endpoint
- 📱 **Persistent Sessions**: WhatsApp session persists across container restarts
- 🎯 **Simple**: Single endpoint for sending messages
- 🔧 **Configurable**: Default group and auth phrase via environment variables

## Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and set your configuration:

```bash
cp .env.example .env
```

**Required environment variables:**

```env
WHATSAPP_AUTH_PHRASE=your-secure-random-phrase-here
WHATSAPP_DEFAULT_GROUP=ECSSR Events
```

### 2. Initialize WhatsApp Session

The first time you run the service, you need to authenticate with WhatsApp by scanning a QR code:

```bash
# Start the container
docker-compose up -d whatsapp-service

# Check the status endpoint to get the QR code
curl http://localhost:3001/api/whatsapp/status
```

The response will include a QR code that you can scan with your WhatsApp mobile app. The session will be persisted in the `whatsapp-service/auth_info` directory.

### 3. Verify Setup

Check that the service is authenticated:

```bash
curl http://localhost:3001/api/whatsapp/status
```

Expected response when connected:
```json
{
  "connected": true,
  "user": {
    "id": "1234567890@s.whatsapp.net",
    "name": "Your Name"
  }
}
```

## API Usage

### Send Message

**Endpoint:** `POST /api/whatsapp/send`

**Request Body:**
```json
{
  "message": "Your message here",
  "groupName": "Optional Group Name",
  "authPhrase": "your-secure-phrase-here"
}
```

**Parameters:**

- `message` (required): The message text to send
- `groupName` (optional): Group name to send to. If not provided, uses `WHATSAPP_DEFAULT_GROUP`
- `authPhrase` (required): Must match `WHATSAPP_AUTH_PHRASE` environment variable

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "sentTo": "ECSSR Events"
}
```

**Example:**

```bash
curl -X POST http://localhost:3001/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎉 New Event Created!\n\nEvent: Annual Conference\nDate: 2025-12-15\nLocation: ECSSR Main Hall",
    "groupName": "ECSSR Events",
    "authPhrase": "your-secure-phrase-here"
  }'
```

### Check Status

**Endpoint:** `GET /api/whatsapp/status`

Returns authentication status.

### Health Check

**Endpoint:** `GET /health`

Returns service health status.

## Message Formatting

The service sends messages **as-is** without any formatting. All message composition and formatting must be done by the calling service (e.g., the main EventVue server).

Example formatted message:
```
🎉 New Event Created!

📅 Event Details:
• Title: Annual Conference 2025
• Date: December 15, 2025
• Time: 10:00 AM - 5:00 PM
• Location: ECSSR Main Hall

👥 Stakeholders:
• John Doe - Event Coordinator
• Jane Smith - Logistics Manager

📝 Description:
Annual conference bringing together researchers and policymakers.

---
View in system: http://localhost/events/123
```

## Troubleshooting

### QR Code Won't Display

Check the service logs for the QR code or connection status:

```bash
docker logs ecssr-whatsapp-service
```

Or access the QR code via the status endpoint:

```bash
curl http://localhost:3001/api/whatsapp/status
```

### Session Lost After Restart

Make sure the `auth_info` directory is properly mounted in `docker-compose.yml`:

```yaml
volumes:
  - ./whatsapp-service/auth_info:/app/auth_info
```

### Group Not Found Error

List available groups via the API:

```bash
curl http://localhost:3001/api/whatsapp/groups
```

Use the exact group name from the list, or check partial matches (service searches case-insensitively).

## Security

- **Never commit** your `.env` file with real credentials
- **Change** the `WHATSAPP_AUTH_PHRASE` to a secure random string
- **Restrict** network access to the service in production
- **Use HTTPS** when exposing the service externally

## Architecture

This service is designed to be a simple relay:

1. **No business logic**: Just sends messages to WhatsApp
2. **No formatting**: Messages are sent exactly as received  
3. **No database**: Stateless except for WhatsApp session
4. **Single responsibility**: Relay messages to groups

All message composition, formatting, templating, and business logic is handled by the main EventVue server.
