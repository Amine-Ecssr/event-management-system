# WhatsApp Integration - Quick Reference

## ✅ What Changed

Successfully using **Baileys** for WhatsApp integration.

### Benefits of Baileys
- ✅ No manual initialization required
- ✅ QR code available directly in the UI
- ✅ Simpler setup and maintenance
- ✅ Better TypeScript support
- ✅ Auto-reconnection handling
- ✅ More active development and community

---

## 🚀 Quick Start (3 Steps)

### 1. Start Services
```bash
docker-compose -f docker-compose.new.yml up -d
```

### 2. Connect WhatsApp
1. Go to http://localhost/settings (login as admin/admin123)
2. Navigate to **WhatsApp Configuration**
3. Click **"Connection Management"** tab
4. Click **"Show QR Code"**
5. Scan with WhatsApp mobile app
6. Wait for "Connected" status

### 3. Configure & Test
1. Click **"Select Group"** to choose target group
2. Enable **"WhatsApp Notifications"** toggle
3. Click **"Send Test Message"**
4. Verify message in WhatsApp group

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `whatsapp-service/src/baileys-manager.ts` | Baileys WhatsApp client manager |
| `whatsapp-service/src/index.ts` | Express API for WhatsApp service |
| `server/whatsapp-client.ts` | HTTP client to communicate with WhatsApp service |
| `server/routes.ts` | API endpoints for frontend |
| `client/src/pages/WhatsAppSettings.tsx` | Admin UI with tabs |
| `docs/WHATSAPP_SETUP.md` | Comprehensive setup guide |

---

## 🔌 API Endpoints

### Status
```bash
GET /api/whatsapp/status
# Returns: { connected, qrCode?, phoneNumber? }
```

### Groups
```bash
GET /api/whatsapp/groups
# Returns: { groups: [{ id, name, participants }] }
```

### Send Message
```bash
POST /api/whatsapp/send
# Body: { message, groupName, authPhrase }
```

---

## 🎨 UI Features

### Connection Management Tab
- Real-time connection status
- QR code display (auto-generated)
- Group selection browser
- Enable/disable notifications
- Send test message
- Disconnect button

### Message Customization Tab
- Event templates (EN/AR)
- Reminder templates (EN/AR)
- Variable substitution
- Language selection

---

## 🐛 Common Issues

### QR Code Not Showing
**Solution:** Check if WhatsApp service is running
```bash
docker logs ecssr-whatsapp-service
```

### Connection Drops
**Solution:** Check session persistence
```bash
ls -la whatsapp-service/auth_info/
```

### Messages Not Sending
**Checklist:**
- [ ] WhatsApp is connected
- [ ] Group is selected
- [ ] Notifications enabled
- [ ] AUTH_PHRASE set
- [ ] Bot is group member

---

## 📚 Documentation

- **Full Setup Guide:** `docs/WHATSAPP_SETUP.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Troubleshooting:** See WHATSAPP_SETUP.md

---

## 🔧 Configuration

### Environment Variables
```bash
WHATSAPP_SERVICE_URL=http://whatsapp-service:3001
WHATSAPP_ENABLED=true
WHATSAPP_AUTH_PHRASE=your-secure-phrase
WHATSAPP_DEFAULT_GROUP=ECSSR Events
```

### Session Persistence
Sessions are stored in `whatsapp-service/auth_info/` and mounted as Docker volume.

---

## ✨ Next Steps

1. **Test the Integration:**
   - Connect WhatsApp via UI
   - Select a group
   - Send test message
   - Create an event and verify notification

2. **Customize Messages:**
   - Go to "Message Customization" tab
   - Edit templates for your needs
   - Use variables for dynamic content

3. **Production Deployment:**
   - Set secure AUTH_PHRASE
   - Configure backup for auth_info/
   - Monitor logs for issues

---

**Status:** ✅ Integration Complete  
**Version:** 1.0 (Baileys)  
**Date:** November 13, 2025
