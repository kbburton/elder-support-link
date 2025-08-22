import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, CheckCircle, XCircle } from "lucide-react";
import SEO from "@/components/layout/SEO";

const ConfirmPromotion = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [promotion, setPromotion] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Invalid confirmation link - no token provided");
      setLoading(false);
      return;
    }

    loadPromotionDetails();
  }, [token]);

  const loadPromotionDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('role_promotion_confirmations')
        .select(`
          *,
          profiles!role_promotion_confirmations_target_user_id_fkey(first_name, last_name),
          care_groups(name)
        `)
        .eq('confirmation_token', token)
        .single();

      if (error) throw error;

      if (!data) {
        setError("Invalid or expired confirmation token");
        return;
      }

      if (data.confirmed_at) {
        setConfirmed(true);
        setError("This role promotion has already been confirmed");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This confirmation link has expired");
        return;
      }

      setPromotion(data);
    } catch (error) {
      console.error('Error loading promotion:', error);
      setError("Failed to load promotion details");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token) return;
    
    setConfirming(true);
    try {
      const { data, error } = await supabase.rpc('confirm_role_promotion', {
        p_token: token
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to confirm promotion');
      }

      setConfirmed(true);
      toast({
        title: "Success",
        description: "Your role promotion has been confirmed successfully!",
      });

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/app");
      }, 3000);

    } catch (error) {
      console.error('Error confirming promotion:', error);
      toast({
        title: "Error",
        description: "Failed to confirm role promotion. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <>
        <SEO 
          title="Confirming Role Promotion"
          description="Please wait while we load your role promotion details."
        />
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading promotion details...</span>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO 
          title="Role Promotion Error"
          description="There was an issue with your role promotion confirmation."
        />
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle>Confirmation Failed</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/app")} variant="outline">
                Return to App
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (confirmed) {
    return (
      <>
        <SEO 
          title="Role Promotion Confirmed"
          description="Your role promotion has been successfully confirmed."
        />
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Role Promotion Confirmed!</CardTitle>
              <CardDescription>
                Your new role has been successfully activated.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                You will be redirected to the app shortly...
              </p>
              <Button onClick={() => navigate("/app")}>
                Go to App Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Confirm Role Promotion"
        description="Confirm your role promotion to gain additional administrative privileges."
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Confirm Role Promotion</CardTitle>
            <CardDescription>
              You have been invited to accept a new administrative role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promotion && (
              <div className="text-center space-y-2">
                <p><strong>User:</strong> {promotion.profiles.first_name} {promotion.profiles.last_name}</p>
                <p><strong>Email:</strong> {promotion.target_email}</p>
                <p><strong>New Role:</strong> {
                  promotion.promotion_type === 'system_admin' 
                    ? 'System Administrator' 
                    : 'Group Administrator'
                }</p>
                {promotion.care_groups && (
                  <p><strong>Group:</strong> {promotion.care_groups.name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Expires: {new Date(promotion.expires_at).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleConfirm} 
                disabled={confirming}
                className="flex-1"
              >
                {confirming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Promotion
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/app")}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ConfirmPromotion;