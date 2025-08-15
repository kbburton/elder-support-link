import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AcceptInvite = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      toast({
        title: "Invalid invitation",
        description: "No invitation ID provided.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    processInvitation();
  }, [id]);

  const processInvitation = async () => {
    try {
      // Get invitation details
      const { data: invitation, error } = await supabase.rpc('get_invitation_by_token', {
        invitation_token: id
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

      // Save invitation data for processing
      const inviteData = {
        invitationId: invitationData.id,
        groupId: invitationData.group_id,
        groupName: invitationData.group_name,
        email: invitedEmail
      };
      localStorage.setItem("pendingInvitation", JSON.stringify(inviteData));

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is authenticated, accept invitation directly
        console.log("🔧 User authenticated, accepting invitation directly");
        const { data: groupId, error: acceptError } = await supabase.rpc("accept_invitation", {
          invitation_id: invitationData.id
        });

        if (acceptError) {
          console.error("❌ accept_invitation failed:", acceptError);
          toast({ 
            title: "Error joining group", 
            description: acceptError.message, 
            variant: "destructive" 
          });
          navigate("/login");
          return;
        }

        if (!groupId) {
          console.warn("❌ Invite not valid (expired/used/invalid)");
          toast({ 
            title: "Invite not valid", 
            description: "Please ask the admin to resend the invite." 
          });
          navigate("/login");
          return;
        }

        // Clear invitation and redirect to group
        // Note: No need to clear pendingInvitation here as it's handled by the new flow
        toast({ 
          title: "Welcome!", 
          description: `Joined ${invitationData.group_name ?? "care group"}` 
        });
        
        // Update last active group
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ last_active_group_id: groupId })
            .eq("user_id", user.id);
        }
        
        navigate(`/app/${groupId}`, { replace: true });
      } else {
        // User not authenticated, redirect to login with invitation data
        const loginUrl = new URL("/login", window.location.origin);
        loginUrl.searchParams.set("token", id);
        if (invitedEmail) {
          loginUrl.searchParams.set("email", invitedEmail);
        }
        
        console.log("📍 User not authenticated, redirecting to login");
        navigate(loginUrl.pathname + loginUrl.search, { replace: true });
      }
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

export default AcceptInvite;