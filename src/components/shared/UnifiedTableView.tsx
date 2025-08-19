import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit, ChevronUp, ChevronDown, Search, SortAsc } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DeleteConfirm } from "@/components/delete/DeleteConfirm";
import { BulkDeleteBar } from "@/components/delete/BulkDeleteBar";

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'date' | 'datetime' | 'badge' | 'user' | 'associations' | 'actions';
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
  getBadgeVariant?: (value: any) => string;
  getAssociations?: (row: any) => Array<{ id: string; title: string; type: string; }>;
}

interface UnifiedTableViewProps {
  title: string;
  data: any[];
  columns: TableColumn[];
  loading?: boolean;
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
  entityType: 'appointment' | 'task' | 'document' | 'contact' | 'activity';
  canDelete?: (item: any) => boolean;
  getItemTitle?: (item: any) => string;
  emptyMessage?: string;
  emptyDescription?: string;
  onCreateNew?: () => void;
  createButtonLabel?: string;
  rowClassName?: (item: any) => string;
  customActions?: (item: any) => React.ReactNode;
}

export function UnifiedTableView({
  title,
  data,
  columns,
  loading = false,
  onEdit,
  onDelete,
  onBulkDelete,
  searchable = true,
  searchPlaceholder = "Search...",
  defaultSortBy,
  defaultSortOrder = 'desc',
  entityType,
  canDelete = () => true,
  getItemTitle = (item) => item.title || item.name || item.id,
  emptyMessage = "No items found",
  emptyDescription = "Start by creating your first item.",
  onCreateNew,
  createButtonLabel = "Create New",
  rowClassName,
  customActions
}: UnifiedTableViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState(defaultSortBy || columns.find(c => c.sortable)?.key || "");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm && searchable) {
      filtered = data.filter(item => {
        return columns.some(col => {
          const value = item[col.key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(searchTerm.toLowerCase());
          }
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase());
          }
          return false;
        });
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
        if (bVal == null) return sortOrder === 'asc' ? 1 : -1;

        // Handle dates
        if (typeof aVal === 'string' && (aVal.includes('T') || aVal.match(/^\d{4}-\d{2}-\d{2}/))) {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        // Handle strings
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        // Handle numbers
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [data, searchTerm, sortBy, sortOrder, columns, searchable]);

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = processedData
        .filter(item => canDelete(item))
        .map(item => item.id);
      setSelectedIds(selectableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length > 0) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
    setShowDeleteConfirm(false);
  };

  const renderCellValue = (column: TableColumn, value: any, row: any) => {
    if (column.render) {
      return column.render(value, row);
    }

    switch (column.type) {
      case 'date':
        return value ? format(new Date(value), 'MMM dd, yyyy') : '-';
      case 'datetime':
        return value ? format(new Date(value), 'MMM dd, yyyy h:mm a') : '-';
      case 'badge':
        const variant = column.getBadgeVariant?.(value) || 'default';
        return value ? <Badge variant={variant as any}>{value}</Badge> : '-';
      case 'user':
        return value || '-';
      case 'associations':
        const associations = column.getAssociations?.(row) || [];
        return (
          <div className="flex flex-wrap gap-1">
            {associations.slice(0, 3).map((assoc, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {assoc.title}
              </Badge>
            ))}
            {associations.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{associations.length - 3} more
              </Badge>
            )}
          </div>
        );
      case 'actions':
        return null; // Actions are handled separately
      default:
        if (typeof value === 'string' && value.length > 100) {
          return (
            <div className="max-w-xs">
              <div className="line-clamp-3 text-sm">{value}</div>
            </div>
          );
        }
        return value || '-';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (processedData.length === 0 && !searchTerm) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="space-y-4">
            <div className="text-muted-foreground text-lg">{emptyMessage}</div>
            <div className="text-muted-foreground text-sm">{emptyDescription}</div>
            {onCreateNew && (
              <Button onClick={onCreateNew}>
                {createButtonLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectableCount = processedData.filter(item => canDelete(item)).length;
  const allSelectableSelected = selectableCount > 0 && selectedIds.length === selectableCount;
  const someSelected = selectedIds.length > 0 && selectedIds.length < selectableCount;

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          )}
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              {createButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Sort Controls */}
      {sortBy && (
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.filter(col => col.sortable).map(col => (
                <SelectItem key={col.key} value={col.key}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {onBulkDelete && selectableCount > 0 && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelectableSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead 
                  key={column.key}
                  className={cn(
                    column.width && `w-${column.width}`,
                    column.sortable && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortBy === column.key && (
                      sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="w-24 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.map((item) => (
              <TableRow 
                key={item.id}
                className={cn(
                  rowClassName?.(item),
                  "hover:bg-muted/50"
                )}
              >
                {onBulkDelete && selectableCount > 0 && (
                  <TableCell>
                    {canDelete(item) && (
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                      />
                    )}
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.width && `w-${column.width}`}>
                    {renderCellValue(column, item[column.key], item)}
                  </TableCell>
                ))}
                {(onEdit || onDelete || customActions) && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {customActions && customActions(item)}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item)}
                          disabled={selectedIds.length > 0}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && canDelete(item) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Bulk Delete Bar */}
      {selectedIds.length > 0 && onBulkDelete && (
        <BulkDeleteBar
          selectedIds={selectedIds}
          entityType={entityType}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirm
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        entityType={entityType}
        count={selectedIds.length}
      />
    </div>
  );
}