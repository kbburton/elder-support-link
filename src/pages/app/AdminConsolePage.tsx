import SEO from "@/components/layout/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useParams } from "react-router-dom";
const AdminConsolePage = () => {
  const { groupId } = useParams();
  const base = `/app/${groupId ?? 'demo'}/admin`;
  return (
    <div className="space-y-6">
      <SEO title="Admin — DaveAssist" description="Manage groups, users, and analytics." />
      <h2 className="text-xl font-semibold">Admin console</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Link to={`${base}/users`}>
          <Card>
            <CardHeader><CardTitle>Users</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">Manage users</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/care-groups`}>
          <Card>
            <CardHeader><CardTitle>Care Groups</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">Manage care groups</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/members`}>
          <Card>
            <CardHeader><CardTitle>Group Members</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">Manage group members</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/appointments`}>
          <Card>
            <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">CRUD appointments</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/tasks`}>
          <Card>
            <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">CRUD tasks</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/documents`}>
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">CRUD documents</CardContent>
          </Card>
        </Link>
        <Link to={`${base}/activity-logs`}>
          <Card>
            <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
            <CardContent className="text-muted-foreground">CRUD activity logs</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default AdminConsolePage;
