import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Activity Logs",
  table: "activity_logs",
  groupScoped: true,
  fields: [
    { name: "date_time", label: "Date/Time", type: "datetime" },
    { name: "type", label: "Type" },
    { name: "title", label: "Title" },
    { name: "notes", label: "Notes", type: "textarea" },
    { name: "attachment_url", label: "Attachment URL" },
    { name: "linked_task_id", label: "Linked Task ID" },
    { name: "linked_appointment_id", label: "Linked Appointment ID" },
    { name: "created_by_user_id", label: "Created By (User ID)" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function ActivityLogsCrud() {
  return <CrudPage config={config} />;
}
