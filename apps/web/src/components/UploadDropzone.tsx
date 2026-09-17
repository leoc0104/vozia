import { useRef, useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { ALLOWED_VIDEO_MIME } from '@vozia/shared'
import { cn } from '../lib/cn'
import { formatBytes } from '../lib/format'

export function UploadDropzone({ file, onFile, error }: { file: File | null; onFile: (file: File | null) => void; error?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped) onFile(dropped)
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white',
        )}
      >
        <UploadCloud className="size-8 text-brand-600" aria-hidden="true" />
        {file ? (
          <p className="mt-3 text-sm text-slate-800">
            <span className="font-medium">{file.name}</span> <span className="text-slate-500">({formatBytes(file.size)})</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Drag a video here, or</p>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 text-sm font-medium text-brand-600 hover:underline">
          {file ? 'Choose a different file' : 'browse your files'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_VIDEO_MIME.join(',')}
          className="sr-only"
          aria-label="Video file"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-3 text-xs text-slate-400">MP4, MOV, WebM or MKV up to 2 GB</p>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
