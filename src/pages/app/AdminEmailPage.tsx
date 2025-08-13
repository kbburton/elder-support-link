import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

const AdminEmailPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();

  console.log('AdminEmailPage rendered');
  console.log('Current search params:', Object.fromEntries(searchParams));
  console.log('Window location:', window.location.href);

  const gmailFrom = 'noreply@burtontechservices.com'; // This will be loaded from GMAIL_FROM secret

  useEffect(() => {
    checkConnection();
    
    // Show success message if redirected from OAuth
    if (searchParams.get('connected') === 'true') {
      toast({
        title: "Gmail Connected",
        description: "Gmail API has been successfully connected.",
      });
    }
  }, [searchParams, toast]);

  const checkConnection = async () => {
    try {
      // This would typically check if we have a valid refresh token
      // For now, we'll just assume it's connected if the user sees a success message
      setIsConnected(false); // Will be updated by actual check
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    console.log('=== Gmail Connect Debug Logs ===');
    
    supabase.auth.getSession().then(({ data }) => {
      console.log('Session check:', {
        hasSession: !!data.session,
        hasToken: !!data.session?.access_token,
        userEmail: data.session?.user?.email,
        userId: data.session?.user?.id
      });
      
      if (data.session?.access_token) {
        // Get current group ID from URL
        const pathParts = window.location.pathname.split('/');
        const currentGroupId = pathParts[2]; // /app/{groupId}/admin/email
        
        // Encode the token and pass it as a URL parameter along with group ID
        const baseUrl = `https://yfwgegapmggwywrnzqvg.functions.supabase.co`;
        const encodedToken = encodeURIComponent(data.session.access_token);
        const encodedGroupId = encodeURIComponent(currentGroupId);
        const oauthUrl = `${baseUrl}/gmail-oauth/start?token=${encodedToken}&groupId=${encodedGroupId}`;
        
        console.log('Redirecting to OAuth URL with token and group ID:', currentGroupId);
        
        // Direct redirect to the OAuth URL with token parameter
        window.location.href = oauthUrl;
      } else {
        console.log('No session or access token available');
        toast({
          title: "Authentication Error",
          description: "Please log in again.",
          variant: "destructive"
        });
      }
    }).catch(error => {
      console.error('=== Gmail Connect Error ===');
      console.error('Error:', error);
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Gmail OAuth",
        variant: "destructive"
      });
    });
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('gmail-send', {
        body: {
          to: session.user.email,
          subject: 'DaveAssist Test Email',
          html: '<p>This is a test email from DaveAssist using Gmail API.</p><p>If you received this, the integration is working correctly!</p>'
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Test Email Sent",
          description: `Successfully sent test email to ${session.user.email}`,
        });
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Test email error:', error);
      toast({
        title: "Test Email Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        body: {},
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setIsConnected(false);
      toast({
        title: "Gmail Disconnected",
        description: "Gmail API has been disconnected.",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Gmail API",
        variant: "destructive"
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (adminLoading || isLoading) {
    return (
      <div className="space-y-6">
        <SEO title="Email Configuration — DaveAssist" description="Configure email settings" />
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <SEO title="Email Configuration — DaveAssist" description="Configure email settings" />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have platform administrator privileges required to access email configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Email Configuration — DaveAssist" description="Configure email settings" />
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Email Configuration</h2>
      </div>

      <div className="grid gap-6">
        {/* Gmail API Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail API Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isConnected ? (
              <>
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    Gmail API is not connected. Click the button below to authenticate with Google and enable email sending.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleConnect} className="w-full">
                  Connect Gmail API
                </Button>
              </>
            ) : (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Gmail API is connected and ready to send emails from {gmailFrom}
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    variant="outline"
                  >
                    {testingEmail ? "Sending..." : "Send Test Email"}
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="destructive"
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Configuration Info */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <strong>From Address:</strong> {gmailFrom}
            </div>
            <div className="text-sm text-muted-foreground">
              All emails will be sent from this Gmail account. Make sure the account has appropriate permissions and settings configured.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminEmailPage;