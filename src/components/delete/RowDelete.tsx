import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import DeleteConfirm from '@/components/delete/DeleteConfirm';
import { useDeletion } from '@/hooks/useDeletion';
import type { EntityType } from '@/lib/delete/types';

type Props = {
  id: string;
  type: EntityType;             // 'contact' | 'task' | 'appointment' | 'activity' | 'document'
  label?: string;               // optional, e.g. 'contact(s)'
  onDone?: () => void;          // call to refresh your list
  variant?: 'icon' | 'button';  // icon-only (default) or full button
};

export default function RowDelete({ id, type, label='item(s)', onDone, variant='icon' }: Props) {
  const [open, setOpen] = useState(false);
  const { softDelete, restore } = useDeletion();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await softDelete(type, [id]);
      toast({
        title: 'Moved to Trash',
        description: 'This is a soft delete. You can restore it from Trash within 30 days.',
        action: (
          <Button variant="outline" onClick={async () => { await restore(type, [id]); onDone?.(); }}>
            Undo
          </Button>
        ),
      });
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === 'button' ? (
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <DeleteConfirm
        open={open}
        onOpenChange={setOpen}
        count={1}
        entityLabel={label}
        onConfirm={handleConfirm}
      />
    </>
  );
}
