import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/layout/SEO";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CareGroupFormTabs } from "@/components/care-group/CareGroupFormTabs";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [existingGroups, setExistingGroups] = useState<any[]>([]);
  const [showGroupSelection, setShowGroupSelection] = useState(false);

  useEffect(() => {
    const loadExistingGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userGroups } = await supabase
          .from('care_group_members')
          .select('group_id, care_groups(id, name)')
          .eq('user_id', user.id);
        
        if (userGroups && userGroups.length > 0) {
          // Check for last active group first
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('last_active_group_id')
            .eq('user_id', user.id)
            .single();
          
          let targetGroupId = userProfile?.last_active_group_id;
          
          // Verify the last active group is still accessible
          if (targetGroupId) {
            const isGroupAccessible = userGroups.some(group => group.group_id === targetGroupId);
            if (!isGroupAccessible) {
              targetGroupId = null;
            }
          }
          
          if (userGroups.length === 1) {
            // Single group - redirect directly
            const groupId = userGroups[0].group_id;
            
            // Update last active group if needed
            if (targetGroupId !== groupId) {
              await supabase
                .from('profiles')
                .update({ last_active_group_id: groupId })
                .eq('user_id', user.id);
            }
            
            toast({ title: "Welcome back", description: "Redirecting to your care group." });
            navigate(`/app/${groupId}`, { replace: true });
            return;
          } else if (targetGroupId) {
            // Has valid last active group - redirect there
            toast({ title: "Welcome back", description: "Redirecting to your care group." });
            navigate(`/app/${targetGroupId}`, { replace: true });
            return;
          } else {
            // Multiple groups but no valid last active - show selection
            setExistingGroups(userGroups);
            setShowGroupSelection(true);
          }
        }
      }
    };
    loadExistingGroups();
  }, [navigate, toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        toast({ title: "Session expired", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({ title: "Session required", description: "Please log in again." });
        navigate("/login", { replace: true });
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate, toast]);

  const handleSuccess = (groupId: string) => {
    navigate(`/app/${groupId}`);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Sign out failed", description: error.message });
      return;
    }
    toast({ title: "Signed out", description: "You have been signed out." });
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen container py-10">
      <SEO title="Onboarding — DaveAssist" description="Create or join a care group." />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Welcome to DaveAssist</h1>
        <Button variant="outline" onClick={handleSignOut}>Log out</Button>
      </div>
      
      {showGroupSelection && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your care groups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">You're a member of multiple care groups. Select one to continue:</p>
            <div className="grid gap-2">
              {existingGroups.map((group) => (
                <Button
                  key={group.group_id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate(`/app/${group.group_id}`)}
                >
                  {group.care_groups?.name || 'Unnamed Group'}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-sm mt-4">Or create/join a new group below:</p>
          </CardContent>
        </Card>
      )}
      
      <CareGroupFormTabs 
        mode="onboarding" 
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Onboarding;