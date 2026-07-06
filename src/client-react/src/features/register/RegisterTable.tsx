import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RegisterAsset } from '@/lib/domain'

const PAGE_SIZE = 25

export function RegisterTable({ assets }: { assets: RegisterAsset[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(
      a => a.no.toLowerCase().includes(q) || (a.desc ?? '').toLowerCase().includes(q),
    )
  }, [assets, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-3 py-2.5 text-sm font-semibold">Register</h2>
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Input
          aria-label="Search asset no. or description"
          placeholder="Search asset no. or description…"
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="max-w-sm"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} assets
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Asset No.</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-56">Parent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a, i) => (
            <TableRow key={`${a.no}-${i}`}>
              <TableCell className="font-mono text-primary">{a.no}</TableCell>
              <TableCell>{a.desc ?? ''}</TableCell>
              <TableCell className="font-mono text-muted-foreground">{a.parent ?? ''}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                No assets match “{search}”.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {current + 1} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= pages - 1}
          onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
        >
          Next
        </Button>
      </div>
    </section>
  )
}
