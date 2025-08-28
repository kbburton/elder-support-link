import { useParams } from "react-router-dom";
import SEO from "@/components/layout/SEO";
import { CareGroupFormTabs } from "@/components/care-group/CareGroupFormTabs";

export default function LovedOneInfoPage() {
  const { groupId } = useParams();

  return (
    <main>
      <SEO
        title="Care recipient info - Care recipient details"
        description="View and update care recipient information including personal details, contact info, and important notes."
        canonicalPath={
          typeof window !== "undefined"
            ? window.location.pathname
            : "/app/loved-one-info"
        }
      />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Care Recipient Info</h1>
        <p className="text-muted-foreground">
          Care recipient information and details.
        </p>
      </header>

      <CareGroupFormTabs 
        mode="editing" 
        groupId={groupId}
      />
    </main>
  );
}
