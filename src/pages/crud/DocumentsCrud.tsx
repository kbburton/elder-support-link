import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Documents",
  table: "documents",
  groupScoped: true,
  fields: [
    { name: "category", label: "Category" },
    { name: "title", label: "Title" },
    { name: "file_url", label: "File URL" },
    { name: "file_type", label: "File Type" },
    { name: "uploaded_by_user_id", label: "Uploaded By (User ID)" },
    { name: "upload_date", label: "Upload Date", type: "datetime" },
    { name: "summary", label: "AI Summary", type: "textarea" },
    { name: "full_text", label: "Full Text (OCR)", type: "textarea" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function DocumentsCrud() {
  return <CrudPage config={config} />;
}
