import React, { useState } from "react";
import SEO from "@/components/layout/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useParams } from "react-router-dom";

const EDGE_URL = "https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/debug-extract-text";
const HEALTH_URL = "https://yfwgegapmggwywrnzqvg.supabase.co/functions/v1/debug-gemini-health";

export default function ExtractionTester() {
  const { groupId } = useParams();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthCheck, setHealthCheck] = useState<any>(null);

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

  const checkHealth = async () => {
    setLoading(true); setError(null); setHealthCheck(null);
    try {
      const resp = await fetch(HEALTH_URL);
      const data = await resp.json();
      setHealthCheck(data);
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Button onClick={checkHealth} disabled={loading} variant="outline">
                {loading ? "Checking..." : "Check API Health"}
              </Button>
              <Button onClick={runBundledTest} disabled={loading}>
                {loading ? "Running..." : "Run test on bundled DOCX"}
              </Button>
            </div>
            <label className="inline-flex items-center gap-2">
              <span className="text-sm">Or upload your own file:</span>
              <Input type="file" onChange={onPickFile} />
            </label>
          </div>
          {error && (
            <div className="text-destructive p-3 bg-destructive/10 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
          {healthCheck && (
            <div className="space-y-2 p-3 bg-muted rounded">
              <div className="font-semibold">API Health Check:</div>
              <div>Status: {healthCheck.success ? "✅ OK" : "❌ Failed"}</div>
              {healthCheck.success && (
                <>
                  <div>Total Models: {healthCheck.totalCount}</div>
                  <div className="text-sm">
                    <strong>Recommendations:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {Object.entries(healthCheck.recommendations).map(([model, status]) => (
                        <li key={model}><code>{model}</code>: {status as string}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer">Show all {healthCheck.models.length} models</summary>
                    <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(healthCheck.models, null, 2)}</pre>
                  </details>
                </>
              )}
              {healthCheck.error && (
                <div className="text-destructive">{healthCheck.error}</div>
              )}
            </div>
          )}
          {result && (
            <div className="space-y-2 p-3 bg-muted rounded">
              <div><strong>Extracted length:</strong> {result.length} characters</div>
              <details>
                <summary className="cursor-pointer font-semibold">Preview (first 5000 chars)</summary>
                <pre className="whitespace-pre-wrap bg-background p-3 rounded max-h-[400px] overflow-auto mt-2 text-xs">{result.preview}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
