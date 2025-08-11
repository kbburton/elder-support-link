import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CalendarPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Calendar — DaveAssist" description="Shared appointments for your care group." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Shared Calendar</h2>
        <div className="flex gap-2">
          <Button variant="hero">New appointment</Button>
          <Button variant="outline">Import</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1,2,3,4].map((id) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Checkup with Dr. Lee <Badge>Medical</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Tue, 10:30 AM • Mercy Hospital</p>
              <p>Attending: Alex</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline">Add attachment</Button>
                <Button size="sm" variant="ghost">Create follow-up task</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CalendarPage;
