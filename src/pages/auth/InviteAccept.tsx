import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { savePendingInvite } from "@/lib/invitations";
import { Loader2 } from "lucide-react";

const InviteAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid invitation",
        description: "No invitation token provided.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    checkInvitationAndRedirect();
  }, [token]);

  const checkInvitationAndRedirect = async () => {
    try {
      // Get invitation details
      const { data: invitation, error } = await supabase.rpc('get_invitation_by_token', {
        invitation_token: token
      });

      if (error || !invitation || invitation.length === 0) {
        toast({
          title: "Invalid invitation",
          description: "This invitation is invalid or has expired.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const invitationData = invitation[0];
      const invitedEmail = invitationData.invited_email;

      // Store invitation token for after login/registration
      savePendingInvite(token!);
      
      // Since we removed email from profiles and can't access auth.users from client,
      // we'll always redirect to login first and let the login page handle whether
      // the user exists or not (it will redirect to register if needed)
      navigate(`/login?email=${encodeURIComponent(invitedEmail)}`, { replace: true });
    } catch (error) {
      console.error("Error processing invitation:", error);
      toast({
        title: "Error",
        description: "Failed to process invitation.",
        variant: "destructive",
      });
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing invitation...</span>
        </div>
      </div>
    );
  }

  // This component should only be redirecting, not showing UI
  return null;
};

export default InviteAccept;