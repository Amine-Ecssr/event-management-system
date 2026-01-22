export interface SendChannelResult {
  success?: boolean;
  message?: string;
}

export interface SendUpdatesResult {
  success?: boolean;
  partialSuccess?: boolean;
  periodLabel?: string;
  email?: SendChannelResult;
  whatsapp?: SendChannelResult;
}

export function parseSendUpdatesResult(result: SendUpdatesResult, fallbackPeriod: string) {
  const emailSuccess = result?.email?.success ?? false;
  const whatsappSuccess = result?.whatsapp?.success ?? false;
  const success = Boolean(result?.success || emailSuccess || whatsappSuccess);
  const partialSuccess = Boolean(result?.partialSuccess ?? (success && !(emailSuccess && whatsappSuccess)));

  const channelIssues: string[] = [];

  if (!emailSuccess && result?.email?.message) {
    channelIssues.push(`Email: ${result.email.message}`);
  }

  if (!whatsappSuccess && result?.whatsapp?.message) {
    channelIssues.push(`WhatsApp: ${result.whatsapp.message}`);
  }

  return {
    success,
    partialSuccess,
    channelIssues,
    periodLabel: result?.periodLabel || fallbackPeriod,
  };
}
