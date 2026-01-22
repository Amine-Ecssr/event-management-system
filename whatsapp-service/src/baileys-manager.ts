import path from 'node:path';
import { rm } from 'node:fs/promises';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type ConnectionState,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'logged-out';

export interface WhatsAppStatus {
  connected: boolean;
  state: ConnectionStatus;
  requiresPairing: boolean;
  reconnecting: boolean;
  qrCode?: string;
  phoneNumber?: string;
  lastConnected?: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participants: number;
}

interface SendMessageOptions {
  message: string;
  groupId?: string;
  groupName?: string;
  attachment?: {
    buffer: Buffer;
    mimetype: string;
    fileName: string;
  };
}

class BaileysManager {
  private sock: WASocket | null = null;
  private readonly authFolder: string;
  private status: ConnectionStatus = 'idle';
  private qrCode: string | undefined;
  private phoneNumber: string | undefined;
  private lastConnectedAt: Date | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectAttempts = 0;
  private startPromise: Promise<void> | null = null;
  private groupsCache: WhatsAppGroup[] = [];
  private groupsCacheExpiry = 0;
  private readonly logger = pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    name: 'whatsapp-service'
  });

  constructor() {
    this.authFolder = path.resolve(process.cwd(), process.env.WHATSAPP_AUTH_DIR ?? 'auth_info');
    this.start().catch(error => {
      this.logger.error({ err: error }, 'failed to initialise WhatsApp socket');
    });
  }

  async getStatus(): Promise<WhatsAppStatus> {
    return {
      connected: this.status === 'connected',
      state: this.status,
      requiresPairing: this.status !== 'connected',
      reconnecting: Boolean(this.reconnectTimer),
      qrCode: this.status !== 'connected' ? this.qrCode : undefined,
      phoneNumber: this.phoneNumber,
      lastConnected: this.lastConnectedAt?.toISOString()
    };
  }

  async getGroups(forceRefresh = false): Promise<WhatsAppGroup[]> {
    await this.start();
    this.assertConnected();

    if (!forceRefresh && Date.now() < this.groupsCacheExpiry) {
      return this.groupsCache;
    }

    const socket = this.sock;
    if (!socket) {
      throw new Error('WhatsApp socket unavailable');
    }

    const groups = await socket.groupFetchAllParticipating();
    const list: WhatsAppGroup[] = Object.values(groups)
      .map(group => ({
        id: group.id,
        name: group.subject,
        participants: group.participants.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.groupsCache = list;
    this.groupsCacheExpiry = Date.now() + 60_000; // cache for 60 seconds
    return list;
  }

  async sendMessage(options: SendMessageOptions): Promise<void> {
    const { message, groupId, groupName, attachment } = options;

    if (!message || !message.trim()) {
      throw new Error('Message is empty');
    }

    if (!groupId && !groupName) {
      throw new Error('Target group not provided');
    }

    await this.start();
    this.assertConnected();

    const socket = this.sock;
    if (!socket) {
      throw new Error('WhatsApp socket unavailable');
    }

    const targetJid = groupId ?? (await this.resolveGroupId(groupName!));

    if (attachment) {
      await socket.sendMessage(targetJid, {
        document: attachment.buffer,
        mimetype: attachment.mimetype,
        fileName: attachment.fileName,
        caption: message,
      });
    } else {
      await socket.sendMessage(targetJid, { text: message });
    }
    this.logger.info({ target: targetJid }, 'message sent');
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();

    if (this.sock) {
      try {
        this.sock.ws?.close();
      } catch (error) {
        this.logger.warn({ err: error }, 'failed to close WhatsApp socket cleanly');
      }
      this.sock = null;
    }

    this.status = 'idle';
    this.reconnectAttempts = 0;
  }

  private async start(): Promise<void> {
    if (this.sock) {
      return;
    }

    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    this.startPromise = this.initializeSocket();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async initializeSocket(): Promise<void> {
    this.status = 'connecting';
    this.clearReconnectTimer();
    this.qrCode = undefined;
    this.logger.info({ authFolder: this.authFolder }, 'initialising WhatsApp connection');

    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.info({ version, isLatest }, 'resolved WhatsApp Web version');
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      const socket = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        logger: this.logger.child({ module: 'baileys' }),
        markOnlineOnConnect: false,
        browser: ['ECSSR Events', 'Desktop', '1.0.0']
      });

      this.sock = socket;
      this.resetCaches();

      socket.ev.on('creds.update', saveCreds);
      socket.ev.on('connection.update', update => {
        this.onConnectionUpdate(update);
      });
    } catch (error) {
      this.status = 'idle';
      this.logger.error({ err: error }, 'failed to create WhatsApp socket');
      throw error;
    }
  }

  private onConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr && qr !== this.qrCode) {
      this.qrCode = qr;
      this.logger.info('QR code received; scan with WhatsApp mobile app');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      this.status = 'connected';
      this.qrCode = undefined;
      this.phoneNumber = this.sock?.user?.id?.split(':')[0];
      this.lastConnectedAt = new Date();
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.logger.info('WhatsApp connection established');
      return;
    }

    if (connection === 'close') {
      const boom = lastDisconnect?.error as Boom | undefined;
      const statusCode = boom?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const badSession = statusCode === DisconnectReason.badSession || statusCode === 405;

      this.logger.warn({ statusCode }, 'WhatsApp connection closed');

      this.sock = null;
      this.status = shouldReconnect ? 'idle' : 'logged-out';

      if (badSession) {
        this.logger.warn('detected bad session; clearing auth state before reconnect');
        void this.clearAuthState().catch(error => {
          this.logger.error({ err: error }, 'failed to clear auth state after bad session');
        });
      }

      if (shouldReconnect) {
        this.scheduleReconnect('connection closed');
      } else {
        this.logger.warn('WhatsApp session logged out; clearing auth state');
        this.qrCode = undefined;
        this.phoneNumber = undefined;
        this.resetCaches();
        this.clearAuthState().catch(error => {
          this.logger.error({ err: error }, 'failed to clear WhatsApp auth state');
        }).finally(() => {
          this.scheduleReconnect('awaiting new QR scan');
        });
      }
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.reconnectTimer) {
      return;
    }

    const delayMs = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.logger.info({ delayMs, attempt: this.reconnectAttempts, reason }, 'scheduling WhatsApp reconnect');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.start().catch(error => {
        this.logger.error({ err: error }, 'reconnect attempt failed');
        this.scheduleReconnect('retry after failure');
      });
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private resetCaches(): void {
    this.groupsCache = [];
    this.groupsCacheExpiry = 0;
  }

  private assertConnected(): void {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp is not connected yet');
    }
  }

  private async resolveGroupId(groupName: string): Promise<string> {
    const groups = await this.getGroups();
    const target = groups.find(group => group.name.toLowerCase() === groupName.toLowerCase());

    if (!target) {
      throw new Error(`Group "${groupName}" not found`);
    }

    return target.id;
  }

  private async clearAuthState(): Promise<void> {
    await rm(this.authFolder, { recursive: true, force: true });
  }
}

export const baileysManager = new BaileysManager();
