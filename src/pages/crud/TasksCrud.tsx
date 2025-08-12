import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Tasks",
  table: "tasks",
  groupScoped: true,
  fields: [
    { name: "title", label: "Title" },
    { name: "description", label: "Description", type: "textarea" },
    { 
      name: "category", 
      label: "Category", 
      type: "select",
      options: [
        { value: "Medical", label: "Medical" },
        { value: "Personal", label: "Personal" },
        { value: "Financial", label: "Financial" },
        { value: "Legal", label: "Legal" },
        { value: "Other", label: "Other" }
      ]
    },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "primary_owner_id", label: "Primary Owner", type: "user_select" },
    { name: "secondary_owner_id", label: "Secondary Owner", type: "user_select" },
    { 
      name: "status", 
      label: "Status",
      type: "select",
      options: [
        { value: "open", label: "Open" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" }
      ]
    },
    { name: "completed_at", label: "Completed At", type: "datetime" },
    { name: "completed_by_email", label: "Completed By", type: "user_select" },
    { name: "created_by_email", label: "Created By", readOnly: true },
    { name: "related_contacts", label: "Related Contacts", type: "contact_multiselect" },
  ],
  creatorFieldName: "created_by_user_id",
  notifyOnCreateEntity: "tasks",
  orderBy: { column: "created_at", ascending: false },
};

export default function TasksCrud() {
  return <CrudPage config={config} />;
}
