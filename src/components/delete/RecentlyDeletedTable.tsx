import { useState } from "react";
import { format } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useRecentlyDeleted, type DeletedItem } from "@/hooks/useRecentlyDeleted";
import { ENTITY_LABELS } from "@/lib/delete/types";

interface RecentlyDeletedTableProps {
  groupId: string;
}

export function RecentlyDeletedTable({ groupId }: RecentlyDeletedTableProps) {
  const { deletedItems, isLoading, restoreItem, isRestoring } = useRecentlyDeleted(groupId);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(deletedItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleRestoreSelected = () => {
    selectedItems.forEach(itemId => {
      const item = deletedItems.find(i => i.id === itemId);
      if (item) {
        restoreItem({ id: item.id, type: item.type });
      }
    });
    setSelectedItems(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Recently Deleted Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading deleted items...</p>
        </CardContent>
      </Card>
    );
  }

  if (deletedItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Recently Deleted Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No recently deleted items found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Recently Deleted Items ({deletedItems.length})
        </CardTitle>
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestoreSelected}
              disabled={isRestoring}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restore Selected ({selectedItems.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedItems(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedItems.size === deletedItems.length && deletedItems.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Deleted Date</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deletedItems.map((item) => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {ENTITY_LABELS[item.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(item.deleted_at), "MMM d, yyyy 'at' h:mm a")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.deleted_by_email}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreItem({ id: item.id, type: item.type })}
                      disabled={isRestoring}
                      className="gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {deletedItems.length >= 50 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Showing the most recent 50 deleted items. Older items are automatically purged after 30 days.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}