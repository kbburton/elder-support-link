import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DocumentsPage = () => {
  return (
    <div className="space-y-6">
      <SEO title="Documents — DaveAssist" description="Securely store and search care documents." />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Document centre</h2>
        <div className="flex gap-2">
          <Button variant="hero">Upload</Button>
          <Input type="search" placeholder="Search" className="w-60" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1,2].map((id) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle>Insurance Policy.pdf</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Type: Legal • Uploaded by Alex • AI summary available</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm" variant="ghost">Link to task</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DocumentsPage;
