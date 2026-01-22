import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold">{t('common.notFound.title')}</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t('common.notFound.description')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
