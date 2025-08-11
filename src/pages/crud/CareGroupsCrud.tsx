import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Care Groups",
  table: "care_groups",
  fields: [
    { name: "created_by_user_id", label: "Created By (User ID)" },
    { name: "name", label: "Recipient Name" },
    { name: "recipient_address", label: "Recipient Address" },
    { name: "recipient_phone", label: "Recipient Phone" },
    { name: "special_dates", label: "Special Dates (JSON)", type: "textarea" },
    { name: "profile_description", label: "Profile Description", type: "textarea" },
    { name: "mobility", label: "Mobility" },
    { name: "memory", label: "Memory" },
    { name: "hearing", label: "Hearing" },
    { name: "vision", label: "Vision" },
    { name: "chronic_conditions", label: "Chronic Conditions" },
    { name: "mental_health", label: "Mental Health" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function CareGroupsCrud() {
  return <CrudPage config={config} />;
}
