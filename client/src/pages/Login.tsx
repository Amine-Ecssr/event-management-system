import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import ecssrLogo from '@assets/ecssr-logo.png';

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Redirect based on user role after login
  useEffect(() => {
    if (user) {
      if (user.role === 'department' || user.role === 'stakeholder' || user.role === 'department_admin') {
        setLocation("/");
      } else {
        setLocation("/admin");
      }
    }
  }, [user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  const isPending = loginMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/50">
      <header className="flex items-center justify-end gap-2 p-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto p-4 rounded-2xl bg-primary/5">
              <img 
                src={ecssrLogo} 
                alt="ECSSR Logo" 
                className="h-16 mx-auto" 
                data-testid="img-ecssr-logo"
              />
            </div>
            <div>
              <CardTitle className="text-2xl">{t('auth.portalTitle')}</CardTitle>
              <CardDescription className="mt-2">
                {t('auth.portalSubtitle')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">{t('auth.username')}</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.enterUsername')}
                  required
                  minLength={3}
                  disabled={isPending}
                  data-testid="input-username"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.enterPassword')}
                  required
                  minLength={6}
                  disabled={isPending}
                  data-testid="input-password"
                  className="h-11"
                />
              </div>
              <Button
                variant="default"
                type="submit"
                className="w-full mt-6 h-11"
                disabled={isPending}
                data-testid="button-submit"
              >
                {isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    {t('auth.signingIn')}
                  </>
                ) : (
                  <>{t('auth.signIn')}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
