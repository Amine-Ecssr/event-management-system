import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { baileysManager } from './baileys-manager.js';

const LOG_PREFIX = '[WhatsApp Service]';

const app = express();
const PORT = process.env.PORT || 3001;

// Get configuration from environment
const AUTH_PHRASE = process.env.WHATSAPP_AUTH_PHRASE || '';
const DEFAULT_GROUP = process.env.WHATSAPP_DEFAULT_GROUP || '';

if (!AUTH_PHRASE) {
  console.warn(`${LOG_PREFIX} WARNING: WHATSAPP_AUTH_PHRASE not set. Service will reject all requests.`);
}

if (!DEFAULT_GROUP) {
  console.warn(`${LOG_PREFIX} WARNING: WHATSAPP_DEFAULT_GROUP not set. Messages without group name will fail.`);
}

const normaliseClientError = (error: unknown): { status: number; message: string } => {
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();

    if (lower.includes('not connected')) {
      return {
        status: 503,
        message: 'WhatsApp session is not connected. Scan the QR code exposed via /api/whatsapp/status.'
      };
    }

    if (lower.includes('target group not provided') || lower.includes('message is empty')) {
      return {
        status: 400,
        message: error.message
      };
    }

    if (lower.includes('group') && lower.includes('not found')) {
      return {
        status: 404,
        message: error.message
      };
    }

    return {
      status: 500,
      message: error.message
    };
  }

  return {
    status: 500,
    message: 'Unknown error'
  };
};

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${LOG_PREFIX} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'whatsapp-service',
    timestamp: new Date().toISOString()
  });
});

// Get WhatsApp session status
app.get('/api/whatsapp/status', async (req: Request, res: Response) => {
  try {
    const status = await baileysManager.getStatus();
    res.json(status);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting status:`, error);
    res.status(500).json({ 
      error: 'Failed to get WhatsApp status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get list of WhatsApp groups
app.get('/api/whatsapp/groups', async (req: Request, res: Response) => {
  try {
    const groups = await baileysManager.getGroups();
    res.json({ groups });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting groups:`, error);
    const mapped = normaliseClientError(error);
    res.status(mapped.status).json({ 
      error: 'Failed to get WhatsApp groups',
      details: mapped.message
    });
  }
});

/**
 * Main message sending endpoint
 * POST /api/whatsapp/send
 * 
 * Body:
 * - message: string (required) - The message to send
 * - groupName: string (optional) - Group name to send to, uses DEFAULT_GROUP if not provided
 * - authPhrase: string (required) - Authentication phrase to authorize sending
 */
app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
  try {
    const { message, groupName, groupId, authPhrase, attachment } = req.body;
    
    // Validate required fields
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ 
        error: 'Missing required field: message'
      });
    }

    if (!authPhrase) {
      return res.status(400).json({ 
        error: 'Missing required field: authPhrase'
      });
    }

    // Validate auth phrase
    if (authPhrase !== AUTH_PHRASE) {
      console.warn(`${LOG_PREFIX} Invalid auth phrase attempt`);
      return res.status(401).json({
        error: 'Invalid authentication phrase'
      });
    }

    // Determine target group
    const targetGroup = (groupName || DEFAULT_GROUP) as string | undefined;

    if (!groupId && !targetGroup) {
      return res.status(400).json({
        error: 'No group specified and no default group configured'
      });
    }

    if (attachment && typeof attachment.content !== 'string') {
      return res.status(400).json({
        error: 'Invalid attachment payload'
      });
    }

    const parsedAttachment = attachment
      ? {
          buffer: Buffer.from(attachment.content, 'base64'),
          mimetype: attachment.mimetype || 'application/octet-stream',
          fileName: attachment.filename || 'attachment',
        }
      : undefined;

    await baileysManager.sendMessage({
      message,
      groupId: typeof groupId === 'string' && groupId.trim() ? groupId.trim() : undefined,
      groupName: !groupId ? targetGroup : undefined,
      attachment: parsedAttachment,
    });
    
    res.json({ 
      success: true,
      message: 'Message sent successfully',
      sentTo: groupId || targetGroup
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending message:`, error);
    const mapped = normaliseClientError(error);
    res.status(mapped.status).json({ 
      error: 'Failed to send message',
      details: mapped.message
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`${LOG_PREFIX} Unhandled error:`, err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`${LOG_PREFIX} Server running on port ${PORT}`);
  console.log(`${LOG_PREFIX} Default group: ${DEFAULT_GROUP || 'NOT SET'}`);
  console.log(`${LOG_PREFIX} Auth phrase: ${AUTH_PHRASE ? 'SET' : 'NOT SET'}`);
  console.log(`${LOG_PREFIX} Baileys WhatsApp client initialised`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(`${LOG_PREFIX} SIGTERM received, shutting down gracefully`);
  await baileysManager.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(`${LOG_PREFIX} SIGINT received, shutting down gracefully`);
  await baileysManager.disconnect();
  process.exit(0);
});
