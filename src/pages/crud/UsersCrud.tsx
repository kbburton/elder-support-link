import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Users",
  table: "users",
  fields: [
    { name: "name", label: "Name" },
    { name: "email", label: "Email" },
    { name: "password_hash", label: "Password Hash" },
    { name: "address", label: "Address" },
    { name: "phone", label: "Phone" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function UsersCrud() {
  return <CrudPage config={config} />;
}
