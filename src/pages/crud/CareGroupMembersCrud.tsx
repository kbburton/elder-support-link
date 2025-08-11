import CrudPage, { CrudConfig } from "@/components/crud/CrudPage";

const config: CrudConfig = {
  title: "Care Group Members",
  table: "care_group_members",
  groupScoped: true,
  fields: [
    { name: "user_id", label: "User ID" },
    { name: "role", label: "Role" },
    { name: "relationship_to_recipient", label: "Relationship to Recipient" },
  ],
  orderBy: { column: "created_at", ascending: false },
};

export default function CareGroupMembersCrud() {
  return <CrudPage config={config} />;
}
