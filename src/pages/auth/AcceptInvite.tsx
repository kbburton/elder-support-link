import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { savePendingInvite } from "@/lib/invitations";
import { Loader2 } from "lucide-react";
import { RelationshipSelectionModal } from "@/components/invitations/RelationshipSelectionModal";

const AcceptInvite = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);

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

      const invitationDetails = invitation[0];
      const invitedEmail = invitationDetails.invited_email;

      // Save invitation token for processing after login
      savePendingInvite(invitationDetails.id);

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is authenticated, show relationship selection modal
        console.log("🔧 User authenticated, showing relationship selection");
        setInvitationData(invitationDetails);
        setShowRelationshipModal(true);
        setLoading(false);
        return;
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

  const handleRelationshipSelect = async (relationship: string) => {
    if (!invitationData) return;
    
    setRelationshipLoading(true);
    try {
      console.log("🔧 Accepting invitation with relationship:", relationship);
      const { data: groupId, error: acceptError } = await supabase.rpc("accept_invitation", {
        invitation_id: invitationData.id,
        p_relationship_to_recipient: relationship
      });

      if (acceptError) {
        console.error("❌ accept_invitation failed:", acceptError);
        toast({ 
          title: "Error joining group", 
          description: acceptError.message, 
          variant: "destructive" 
        });
        return;
      }

      if (!groupId) {
        console.warn("❌ Invite not valid (expired/used/invalid)");
        toast({ 
          title: "Invite not valid", 
          description: "Please ask the admin to resend the invite." 
        });
        return;
      }

      // Update last active group
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ last_active_group_id: groupId })
          .eq("user_id", user.id);
      }
      
      toast({ 
        title: "Welcome!", 
        description: `Joined ${invitationData.group_name ?? "care group"}` 
      });
      
      navigate(`/app/${groupId}`, { replace: true });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to join care group.",
        variant: "destructive",
      });
    } finally {
      setRelationshipLoading(false);
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

  return (
    <>
      <RelationshipSelectionModal
        isOpen={showRelationshipModal}
        onClose={() => {
          setShowRelationshipModal(false);
          navigate("/login");
        }}
        onSelect={handleRelationshipSelect}
        groupName={invitationData?.group_name}
        loading={relationshipLoading}
      />
    </>
  );
};

export default AcceptInvite;