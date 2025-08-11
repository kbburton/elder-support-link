import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminConsolePage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Admin — DaveAssist" description="Manage groups, users, and analytics." />
      <h2 className="text-xl font-semibold">Admin console</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">12 total</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">126 this month</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">342 stored</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminConsolePage;
