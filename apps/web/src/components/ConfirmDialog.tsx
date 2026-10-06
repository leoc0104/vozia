import { useState, type ReactElement } from 'react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui'

export interface ConfirmDialogProps {
  trigger: ReactElement
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void> | void
  busy?: boolean
}

/** Asks before a destructive action. The dialog cannot be dismissed while the action is running. */
export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm, busy = false }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)

  async function confirm() {
    try {
      await onConfirm()
    } finally {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : setOpen(next))}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy} className="w-full sm:w-fit">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" isLoading={busy} className="w-full sm:w-fit" onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
