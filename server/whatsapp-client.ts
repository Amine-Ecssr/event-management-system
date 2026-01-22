/**
 * WhatsApp Service Client
 * 
 * HTTP client for communicating with the isolated WhatsApp service.
 * Provides a clean interface for the main server to send WhatsApp messages
 * without managing WhatsApp sessions directly.
 */

import type { Event } from '@shared/schema';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001';

interface WhatsAppStatus {
  connected: boolean;
  qrCode?: string;
  phoneNumber?: string;
}

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
}

export interface WhatsAppAttachment {
  filename: string;
  mimetype: string;
  content: string;
}

/**
 * WhatsApp Service Client
 */
class WhatsAppServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = WHATSAPP_SERVICE_URL) {
    this.baseUrl = baseUrl;
    console.log('[WhatsApp Client] Initialized with URL:', this.baseUrl);
  }

  /**
   * Make HTTP request to WhatsApp service
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[WhatsApp Client] Request failed to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get WhatsApp service health status
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    return this.request('/health');
  }

  /**
   * Get WhatsApp session status (Baileys)
   */
  async getStatus(): Promise<WhatsAppStatus> {
    return this.request('/api/whatsapp/status');
  }

  /**
   * Check if authenticated (backwards compatibility)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.connected;
    } catch {
      return false;
    }
  }

  /**
   * Get WhatsApp groups
   */
  async getGroups(): Promise<{ groups: Array<{ id: string; name: string; participants: number }> }> {
    return this.request('/api/whatsapp/groups');
  }

  /**
   * Logout WhatsApp session
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/whatsapp/logout', {
      method: 'POST',
    });
  }

  /**
   * Get chat list
   */
  async getChatList(): Promise<{ chats: WhatsAppChat[]; success: boolean }> {
    return this.request('/api/whatsapp/chats');
  }

  /**
   * Send a generic message to a group
   */
  async sendMessage(params: {
    message: string;
    groupId?: string | null;
    groupName?: string | null;
    authPhrase?: string;
    attachment?: WhatsAppAttachment;
  }): Promise<{ success: boolean; message: string }> {
    const { message, groupId, groupName, authPhrase, attachment } = params;
    const phrase = authPhrase ?? process.env.WHATSAPP_AUTH_PHRASE ?? '';

    const payload: Record<string, any> = {
      message,
      authPhrase: phrase,
    };

    if (groupId) {
      payload.groupId = groupId;
    }

    if (groupName) {
      payload.groupName = groupName;
    }

    if (attachment) {
      payload.attachment = attachment;
    }

    return this.request('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send event notification
   */
  async sendEventNotification(event: Event, chatId: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/whatsapp/notify/event', {
      method: 'POST',
      body: JSON.stringify({ event, chatId }),
    });
  }

  /**
   * Send event notification with stakeholders
   */
  async sendEventNotificationWithStakeholders(
    event: Event,
    chatId: string,
    assignments: any[]
  ): Promise<{ success: boolean; message: string }> {
    return this.request('/api/whatsapp/notify/event-with-stakeholders', {
      method: 'POST',
      body: JSON.stringify({ event, chatId, assignments }),
    });
  }

  /**
   * Send task reminder
   */
  async sendTaskReminder(
    task: any,
    event: Event,
    chatId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request('/api/whatsapp/notify/task-reminder', {
      method: 'POST',
      body: JSON.stringify({ task, event, chatId }),
    });
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppServiceClient();
