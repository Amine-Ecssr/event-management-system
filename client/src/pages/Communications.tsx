import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MessageSquare } from 'lucide-react';
import EmailConfig from './EmailConfig';
import WhatsAppSettings from './WhatsAppSettings';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

export default function Communications() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('email');
  const { t } = useTranslation();

  // Redirect if not superadmin
  if (user && user.role !== 'superadmin') {
    return <Redirect to="/" />;
  }

  return (
    <div className="p-6">
      <PageHeader
        title={t('communications.title')}
        subtitle={t('communications.subtitle')}
        icon={Mail}
        iconColor="text-primary"
      />

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6" data-testid="tabs-communications">
            <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              {t('communications.email')}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2" data-testid="tab-whatsapp">
              <MessageSquare className="h-4 w-4" />
              {t('communications.whatsapp')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-0">
            <EmailConfig />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-0">
            <WhatsAppSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
