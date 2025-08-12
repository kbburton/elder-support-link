import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const InviteAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);

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

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      // Use RPC function to get invitation by token
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

      setInvitation(invitation[0]);
    } catch (error) {
      console.error("Error fetching invitation:", error);
      toast({
        title: "Error",
        description: "Failed to load invitation details.",
        variant: "destructive",
      });
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!invitation) return;

    setAccepting(true);
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Store invitation token and redirect to login
        localStorage.setItem("pendingInvitation", token!);
        toast({
          title: "Please log in",
          description: "You need to log in to accept this invitation.",
        });
        navigate("/login");
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("care_group_members")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("group_id", invitation.group_id)
        .maybeSingle();

      if (existingMember) {
        toast({
          title: "Already a member",
          description: "You are already a member of this group.",
        });
        navigate(`/app/${invitation.group_id}`);
        return;
      }

      // Add user to group
      const { error: memberError } = await supabase
        .from("care_group_members")
        .insert({
          user_id: session.user.id,
          group_id: invitation.group_id,
          is_admin: false,
        });

      if (memberError) {
        console.error("Error adding member:", memberError);
        toast({
          title: "Error",
          description: "Failed to join the group. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Update invitation status using RPC
      await supabase.rpc('accept_invitation', {
        invitation_id: invitation.id,
        user_id: session.user.id
      });

      toast({
        title: "Welcome!",
        description: `You have successfully joined ${invitation.group_name}.`,
      });

      navigate(`/app/${invitation.group_id}`);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Care Group Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a care group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation && (
            <>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">{invitation.group_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Invited by: {invitation.invited_by_email}
                </p>
                {invitation.message && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm italic">"{invitation.message}"</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col space-y-2">
                <Button 
                  onClick={acceptInvitation} 
                  disabled={accepting}
                  className="w-full"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Accepting...
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;