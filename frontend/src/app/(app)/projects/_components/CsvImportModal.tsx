// frontend/src/app/projects/_components/CsvImportModal.tsx
'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ImportError = {
  row: number
  field: string
  message: string
}

type Props = {
  projectId: string
  onClose: () => void
  onSaved: () => void
}

export default function CsvImportModal({ projectId, onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<string[][] | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setErrors([])

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) ?? []
      const dataRows = lines.slice(1)
      setTotalRows(dataRows.length)
      const previewRows = dataRows.slice(0, 5).map(row =>
        row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      )
      setPreview([headers, ...previewRows])
    }
    reader.readAsText(f)
  }

  async function handleImport() {
    if (!file) return
    setErrors([])
    setImporting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
      const res = await fetch(`${backend}/units/import?project_id=${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json()
        if (body.detail?.errors) {
          setErrors(body.detail.errors)
          return
        }
        throw new Error(body.detail || 'Import failed')
      }

      const result = await res.json()
      onSaved()
      onClose()
      alert(`تم استيراد ${result.imported} وحدة بنجاح`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrors([{ row: 0, field: '', message: err.message }])
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">استيراد وحدات من CSV</h2>

        <div className="mb-4 p-3 bg-bg-elevated rounded-xl text-xs text-text-secondary space-y-1">
          <p className="font-medium">الأعمدة المطلوبة:</p>
          <p className="font-mono">building_number, unit_number, floor, area_sqm, price, sak_id</p>
          <p className="font-medium mt-1">اختيارية:</p>
          <p className="font-mono">electricity_meter_id, water_meter_id</p>
          <p className="text-text-muted mt-1">يجب أن تكون المباني موجودة مسبقاً. يُرجع الملف بأكمله في حال وجود أي خطأ.</p>
        </div>

        <div className="mb-4">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-ghost border border-border w-full py-3 text-sm"
          >
            {fileName || 'اختر ملف CSV...'}
          </button>
        </div>

        {preview && (
          <div className="mb-4 overflow-x-auto">
            <p className="text-xs text-text-secondary mb-2">معاينة ({totalRows} صف)</p>
            <table className="text-xs w-full border border-border rounded-xl overflow-hidden">
              <thead className="bg-bg-elevated">
                <tr>
                  {preview[0].map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-right font-medium text-text-secondary border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {totalRows > 5 && (
              <p className="text-xs text-text-muted mt-1 text-center">... و {totalRows - 5} صفوف أخرى</p>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-sm max-h-48 overflow-y-auto">
            <p className="font-semibold text-danger mb-2">أخطاء في الملف ({errors.length})</p>
            <div className="space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-danger">
                  {e.row > 0 ? `صف ${e.row}` : 'خطأ عام'}{e.field ? ` (${e.field})` : ''}: {e.message}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="btn-primary flex-1"
            disabled={!file || importing}
          >
            {importing ? 'جارٍ الاستيراد...' : 'استيراد'}
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  )
}
