import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ExternalLink, Calendar, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

interface ScraperSource {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: typeof Calendar;
  url: string;
}

export default function Scrapers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [activeScraperId, setActiveScraperId] = useState<string | null>(null);

  // Redirect if not superadmin
  if (user && user.role !== 'superadmin') {
    return <Redirect to="/" />;
  }

  const scraperSources: ScraperSource[] = [
    {
      id: "all",
      name: t('scrapers.allSourcesName'),
      description: t('scrapers.allSourcesDescription'),
      endpoint: "/api/scraper/all",
      icon: Calendar,
      url: "",
    },
    {
      id: "abu-dhabi",
      name: t('scrapers.abuDhabiName'),
      description: t('scrapers.abuDhabiDescription'),
      endpoint: "/api/scraper/abu-dhabi",
      icon: Calendar,
      url: "https://www.mediaoffice.abudhabi/en/abu-dhabi-events/",
    },
    {
      id: "adnec",
      name: t('scrapers.adnecName'),
      description: t('scrapers.adnecDescription'),
      endpoint: "/api/scraper/adnec",
      icon: Calendar,
      url: "https://www.adnec.ae/en/eventlisting",
    },
  ];

  const scrapeMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to scrape events: ${response.statusText}`);
      }
      
      return response.json() as Promise<any>;
    },
    onSuccess: (data, variables) => {
      const source = scraperSources.find(s => s.endpoint === variables);
      
      // Handle "all" endpoint which returns { abuDhabi: {...}, adnec: {...} }
      if (variables === "/api/scraper/all") {
        const abuDhabiResult = data.abuDhabi || { added: 0, updated: 0, skipped: 0, deleted: 0 };
        const adnecResult = data.adnec || { added: 0, updated: 0, skipped: 0, deleted: 0 };
        const total = abuDhabiResult.added + abuDhabiResult.updated + adnecResult.added + adnecResult.updated;
        
        toast({
          title: t('scrapers.scrapingCompleted'),
          description: `${source?.name}: ${t('scrapers.addedCount', { count: abuDhabiResult.added + adnecResult.added })} ${t('scrapers.updatedCount', { count: abuDhabiResult.updated + adnecResult.updated })} ${t('scrapers.skippedCount', { count: abuDhabiResult.skipped + adnecResult.skipped })} (${t('scrapers.total')}: ${total})`,
        });
      } else {
        // Single source response
        const total = data.added + data.updated;
        toast({
          title: t('scrapers.scrapingCompleted'),
          description: `${source?.name}: ${t('scrapers.addedCount', { count: data.added })} ${t('scrapers.updatedCount', { count: data.updated })} ${t('scrapers.skippedCount', { count: data.skipped })} (${t('scrapers.total')}: ${total})`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setActiveScraperId(null);
    },
    onError: (error: Error, variables) => {
      const source = scraperSources.find(s => s.endpoint === variables);
      
      toast({
        title: t('scrapers.scrapingFailed'),
        description: `${t('scrapers.failedToSync')} ${source?.name}: ${error.message}`,
        variant: "destructive",
      });
      
      setActiveScraperId(null);
    },
  });

  const handleScrape = (source: ScraperSource) => {
    setActiveScraperId(source.id);
    scrapeMutation.mutate(source.endpoint);
  };

  return (
    <div className="p-6">
      <PageHeader
        title={t('scrapers.title')}
        subtitle={t('scrapers.subtitle')}
        icon={Globe}
        iconColor="text-primary"
      />

      <div className="max-w-5xl mx-auto">
        <Alert className="mb-6">
          <AlertDescription>
            {t('scrapers.alertDescription')}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
        {scraperSources.map((source) => {
          const Icon = source.icon;
          const isActive = activeScraperId === source.id;
          const isAnyActive = activeScraperId !== null;

          return (
            <Card key={source.id} data-testid={`card-scraper-${source.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {source.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {source.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        data-testid={`button-view-${source.id}`}
                      >
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {t('scrapers.viewSource')}
                        </a>
                      </Button>
                    )}
                    <Button
                      onClick={() => handleScrape(source)}
                      disabled={isAnyActive}
                      data-testid={`button-sync-${source.id}`}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isActive ? "animate-spin" : ""}`} />
                      {isActive ? t('scrapers.syncing') : t('scrapers.syncNow')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t('scrapers.howScrapersWork')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">{t('scrapers.automaticSyncing')}:</strong> {t('scrapers.automaticSyncingDesc')}
          </p>
          <p>
            <strong className="text-foreground">{t('scrapers.deduplication')}:</strong> {t('scrapers.deduplicationDesc')}
          </p>
          <p>
            <strong className="text-foreground">{t('scrapers.adminProtection')}:</strong> {t('scrapers.adminProtectionDesc')}
          </p>
          <p>
            <strong className="text-foreground">{t('scrapers.visibilityControl')}:</strong> {t('scrapers.visibilityControlDesc')}
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
