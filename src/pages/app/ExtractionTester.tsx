import React, { useState } from "react";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useParams } from "react-router-dom";

const EDGE_URL = "https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/debug-extract-text";

export default function ExtractionTester() {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runBundledTest = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/test/Dr_Samples_Letter_-_Sent.docx");
      const blob = await res.blob();
      const file = new File([blob], "Dr_Samples_Letter_-_Sent.docx", { type: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch(EDGE_URL, { method: "POST", body: form });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const resp = await fetch(EDGE_URL, { method: "POST", body: form });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <main className="container mx-auto p-4 space-y-4">
      <SEO title="Document Extraction Tester" description="Test Gemini-based text extraction" canonicalPath={`/app/${groupId}/debug/extraction`} />
      <Card>
        <CardHeader>
          <CardTitle>Extraction Tester</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={runBundledTest} disabled={loading}>
              {loading ? "Running..." : "Run test on bundled DOCX"}
            </Button>
            <label className="inline-flex items-center gap-2">
              <Input type="file" onChange={onPickFile} />
            </label>
          </div>
          {error && (
            <div className="text-destructive">Error: {error}</div>
          )}
          {result && (
            <div className="space-y-2">
              <div>Extracted length: {result.length}</div>
              <pre className="whitespace-pre-wrap bg-muted p-3 rounded max-h-[400px] overflow-auto">{result.preview}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
