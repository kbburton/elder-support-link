import SEO from "@/components/layout/SEO";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SearchPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Search — DaveAssist" description="Search across appointments, tasks, documents, and activities." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Search</h2>
        <Input type="search" placeholder="Search this group" className="w-80" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No results yet</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No results yet</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No results yet</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">No results yet</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SearchPage;
