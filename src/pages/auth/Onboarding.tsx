import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SEO from "@/components/layout/SEO";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen container py-10">
      <SEO title="Onboarding — DaveAssist" description="Create or join a care group and choose modules." />
      <h1 className="text-2xl font-semibold mb-6">Welcome to DaveAssist</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create a new care group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="calendar" defaultChecked />
                <Label htmlFor="calendar">Calendar</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="tasks" defaultChecked />
                <Label htmlFor="tasks">Tasks</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="documents" defaultChecked />
                <Label htmlFor="documents">Document centre</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="activity" defaultChecked />
                <Label htmlFor="activity">Activity log</Label>
              </div>
            </div>
            <Button variant="hero" onClick={() => navigate('/app/demo/calendar')}>Create group</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Join an existing group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">Ask an admin for an invitation link or code, then paste it here.</p>
            <Button variant="outline" onClick={() => navigate('/login')}>I have an invite</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
