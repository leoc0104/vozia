import { useState, type FormEvent } from 'react'
import type { DubSegmentRow } from '@vozia/db'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from './ui'

export interface RetakeDialogProps {
  /** The line to re-take; the dialog is open while there is one. */
  segment: DubSegmentRow | null
  sourceLang?: string | null
  targetLang?: string
  onClose: () => void
  /** Sends the new words; a thrown error is shown in the dialog. */
  onSubmit: (text: string) => Promise<void>
}

/**
 * Asks for the words a line should say instead. The new voice records the line again, directed like the rest of the
 * dub, and the dub is remixed; the other lines stay as they are. Give it a `key` per line so it opens fresh.
 */
export function RetakeDialog({ segment, sourceLang, targetLang, onClose, onSubmit }: RetakeDialogProps) {
  const [text, setText] = useState(segment?.translated_text ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const words = text.trim()
    if (words === '') {
      setError('Write the words of the line.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(words)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The line could not be re-taken.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={segment !== null} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Re-take this line</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              The new voice records it again in your words, directed like the rest of the dub. The other lines stay as
              they are, and the dub you have keeps playing until the new one is ready.
            </DialogDescription>
          </DialogHeader>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Original: <span dir="auto" lang={sourceLang ?? undefined} className="text-gray-900 dark:text-gray-50">{segment?.text}</span>
          </p>
          <div className="mt-4">
            <Field label="New words" htmlFor="retake-text" error={error}>
              <Textarea
                id="retake-text"
                dir="auto"
                lang={targetLang}
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          </div>
          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="secondary" disabled={busy} className="w-full sm:w-fit">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" isLoading={busy} className="w-full sm:w-fit">
              Re-take line
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
