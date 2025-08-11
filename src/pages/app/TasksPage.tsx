import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TasksPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Tasks — DaveAssist" description="Assign and track tasks across caregivers." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <div className="flex gap-2">
          <Button variant="hero">New task</Button>
          <Button variant="outline">Templates</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1,2,3].map((id) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Refill medication <Badge>Medical</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Due: Friday • Owner: Jamie • Status: Open</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline">Complete</Button>
                <Button size="sm" variant="ghost">Duplicate</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TasksPage;
