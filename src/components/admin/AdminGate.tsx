import React from 'react';
import { AlertTriangle, Mail, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminGate: React.FC<AdminGateProps> = ({ children, fallback }) => {
  const { 
    isPlatformAdmin, 
    isEmailVerified, 
    isMfaEnrolled, 
    isLoading, 
    canAccessAdmin,
    refreshAdminStatus 
  } = usePlatformAdmin();
  const { toast } = useToast();

  const handleResendVerification = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: (await supabase.auth.getUser()).data.user?.email || '',
      });

      if (error) throw error;

      toast({
        title: "Verification email sent",
        description: "Please check your email and click the verification link.",
      });
    } catch (error) {
      console.error('Error resending verification:', error);
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSetupMfa = async () => {
    try {
      // Redirect to MFA setup (this would typically be a separate page/modal)
      toast({
        title: "MFA Setup Required",
        description: "Please contact support to set up multi-factor authentication.",
      });
    } catch (error) {
      console.error('Error setting up MFA:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return fallback || (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
          <CardDescription>
            You don't have platform administrator privileges.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Additional Setup Required
            </CardTitle>
            <CardDescription>
              Platform administrators must complete additional security requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEmailVerified && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>Email Verification Required</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-3">
                    Your email address must be verified to access admin features.
                  </p>
                  <Button onClick={handleResendVerification} variant="outline" size="sm">
                    Resend Verification Email
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!isMfaEnrolled && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Multi-Factor Authentication Required</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-3">
                    MFA must be enabled for platform administrator accounts.
                  </p>
                  <Button onClick={handleSetupMfa} variant="outline" size="sm">
                    Set Up MFA
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4">
              <Button onClick={refreshAdminStatus} variant="outline">
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};