import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { useState } from "react";
import { DemoEmailModal } from "@/components/demo/DemoEmailModal";
import { useDemoContext } from "@/contexts/DemoContext";
import demoData from "@/data/demo-data.json";

const Index = () => {
  const navigate = useNavigate();
  const [coords, setCoords] = useState({ x: 0.5, y: 0.5 });
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");
  
  const { startDemoSession } = useDemoContext();

  const handleDemoStart = () => {
    setShowDemoModal(true);
    setDemoError("");
  };

  const handleDemoEmailSubmit = async (email: string) => {
    setDemoLoading(true);
    setDemoError("");
    
    try {
      const result = await startDemoSession(email);
      
      if (result.success) {
        setShowDemoModal(false);
        navigate(`/app/${demoData.demoGroupId}/calendar`);
      } else {
        // Check if we need to redirect to landing page
        if (result.redirectToLanding) {
          setShowDemoModal(false);
          setDemoError(result.error || "Please sign in to access your account");
          // The error will be displayed on the landing page
        } else {
          // Display the specific error message from the backend
          setDemoError(result.error || "Failed to start demo");
        }
      }
    } catch (error) {
      console.error('Demo session error:', error);
      setDemoError('Something went wrong. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleDemoCancel = () => {
    setShowDemoModal(false);
    setDemoError("");
  };

  return (
    <>
      <div
        className="min-h-screen bg-background relative overflow-hidden"
        onMouseMove={(e) => {
          const x = e.clientX / window.innerWidth;
          const y = e.clientY / window.innerHeight;
          document.documentElement.style.setProperty("--cursor-x", `${x * 100}%`);
          document.documentElement.style.setProperty("--cursor-y", `${y * 100}%`);
        }}
      >
        <SEO title="DaveAssist — Care Coordination" description="Coordinate care for loved ones with shared calendars, tasks, documents, and activity logs." />

        <div className="absolute inset-0 bg-hero pointer-events-none" />

        <div className="container mx-auto px-6 py-20 relative">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md shadow-glow" style={{ background: "var(--gradient-primary)" }} />
            <span className="text-xl font-semibold">DaveAssist</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/login")}>Log in</Button>
            <Button variant="hero" onClick={() => navigate("/register")}>Get Started</Button>
          </div>
        </header>

        <main className="mt-24 grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">Coordinate care for your loved ones together</h1>
            <p className="mt-4 text-lg text-muted-foreground">Create secure care groups, share calendars and tasks, manage documents, and keep everyone in sync.</p>
            {demoError && !showDemoModal && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{demoError}</p>
              </div>
            )}
            <div className="mt-8 flex gap-3">
              <Button variant="hero" className="transition-smooth" onClick={() => navigate("/register")}>Create a care group</Button>
              <Button variant="outline" onClick={handleDemoStart}>Try demo</Button>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-glow">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-md border p-4">
                <p className="font-medium">Shared Calendar</p>
                <p className="text-sm text-muted-foreground">Appointments with reminders</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Tasks</p>
                <p className="text-sm text-muted-foreground">Assign owners and track status</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Documents</p>
                <p className="text-sm text-muted-foreground">Secure storage and AI summaries</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Activity Log</p>
                <p className="text-sm text-muted-foreground">Phone/video/in-person notes</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Contacts</p>
                <p className="text-sm text-muted-foreground">Manage care team and providers</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="font-medium">Universal Search</p>
                <p className="text-sm text-muted-foreground">Find anything across all data</p>
              </div>
            </div>
          </div>
        </main>
        </div>
      </div>
      
      <DemoEmailModal
        isOpen={showDemoModal}
        onSuccess={handleDemoEmailSubmit}
        onCancel={handleDemoCancel}
        isLoading={demoLoading}
        error={demoError}
      />
    </>
  );
};

export default Index;
