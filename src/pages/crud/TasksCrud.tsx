import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Tasks",
  table: "tasks",
  groupScoped: true,
  fields: [
    { name: "title", label: "Title" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "category", label: "Category" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "primary_owner_id", label: "Primary Owner ID" },
    { name: "secondary_owner_id", label: "Secondary Owner ID" },
    { name: "created_by_user_id", label: "Created By (User ID)" },
    { name: "status", label: "Status" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function TasksCrud() {
  return <CrudPage config={config} />;
}
