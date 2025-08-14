import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { User, LogOut, Settings, Users, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useDemo } from "@/hooks/useDemo";
import { useDemoContext } from "@/contexts/DemoContext";

interface UserMenuProps {
  onSwitchGroup?: () => void;
  variant?: "desktop" | "mobile";
  className?: string;
}

export function UserMenu({ onSwitchGroup, variant = "desktop", className }: UserMenuProps) {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { toast } = useToast();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const { isDemo, demoSession } = useDemo();
  const { endDemoSession } = useDemoContext();

  useEffect(() => {
    // Set demo user info if in demo mode
    if (isDemo) {
      setUser({
        email: demoSession?.email || "demo@example.com",
        name: "Demo User"
      });
      return;
    }

    const loadUser = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        // Try to get display name from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const displayName = profile?.first_name 
          ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
          : auth.user.email?.split('@')[0] || "User";

        setUser({
          email: auth.user.email || "",
          name: displayName
        });
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };

    loadUser();
  }, [isDemo, demoSession]);

  const handleSignOut = async () => {
    try {
      // Handle demo logout
      if (isDemo) {
        endDemoSession();
        navigate("/");
        return;
      }

      await supabase.auth.signOut();
      
      // Clear any localStorage auth tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      toast({ title: "Signed out", description: "You have been signed out successfully." });
      navigate("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ 
        title: "Sign out failed", 
        description: "Please try again.",
        variant: "destructive" 
      });
    }
  };

  const handleSignOutAllDevices = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      
      // Clear any localStorage auth tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      toast({ title: "Signed out", description: "You have been signed out from all devices." });
      navigate("/login");
    } catch (error) {
      console.error("Global sign out error:", error);
      toast({ 
        title: "Sign out failed", 
        description: "Please try again.",
        variant: "destructive" 
      });
    }
  };

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (variant === "mobile") {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 p-4 border-b">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        
        <div className="p-2 space-y-1">
          {!isDemo && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={onSwitchGroup}
              >
                <Users className="h-4 w-4" />
                Switch care group
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => navigate("/app/groups/new")}
              >
                <Plus className="h-4 w-4" />
                Create care group
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => navigate(`/app/${groupId}/settings`)}
              >
                <Settings className="h-4 w-4" />
                Group settings
              </Button>
            </>
          )}
          
          <div className="border-t pt-2 mt-2 space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {isDemo ? "Exit Demo" : "Sign out"}
            </Button>
            
            {!isDemo && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive text-xs"
                onClick={handleSignOutAllDevices}
              >
                <LogOut className="h-4 w-4" />
                Sign out all devices
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {!isDemo && (
          <>
            <DropdownMenuItem onClick={onSwitchGroup}>
              <Users className="mr-2 h-4 w-4" />
              Switch care group
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => navigate("/app/groups/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create care group
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => navigate(`/app/${groupId}/settings`)}>
              <Settings className="mr-2 h-4 w-4" />
              Group settings
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {isDemo ? "Exit Demo" : "Sign out"}
        </DropdownMenuItem>
        
        {!isDemo && (
          <DropdownMenuItem onClick={handleSignOutAllDevices} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out all devices
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}