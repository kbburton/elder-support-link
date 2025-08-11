import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Appointments",
  table: "appointments",
  groupScoped: true,
  fields: [
    { name: "date_time", label: "Date/Time", type: "datetime" },
    { name: "location", label: "Location" },
    { name: "category", label: "Category" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "attending_user_id", label: "Attending User ID" },
    { name: "created_by_user_id", label: "Created By (User ID)" },
    { name: "reminder_days_before", label: "Reminder Days Before", type: "number" },
    { name: "outcome_notes", label: "Outcome Notes", type: "textarea" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function AppointmentsCrud() {
  return <CrudPage config={config} />;
}
