import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ActivityLogPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Activity Log — DaveAssist" description="Log calls, visits, and interactions." />
      <h2 className="text-xl font-semibold">Activity log</h2>

      <Card>
        <CardHeader>
          <CardTitle>New activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select defaultValue="phone">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone call</SelectItem>
                <SelectItem value="video">Video call</SelectItem>
                <SelectItem value="inperson">In-person</SelectItem>
                <SelectItem value="mail">Mail</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Short title" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Detailed notes</Label>
            <Textarea placeholder="Notes..." rows={5} />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button variant="outline">Save</Button>
            <Button variant="outline">Save & create task</Button>
            <Button variant="hero">Save & create appointment</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogPage;
