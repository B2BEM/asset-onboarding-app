import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import CountUp from '@/components/CountUp'
import { RegisterTable } from '@/features/register/RegisterTable'
import { getBootstrap, getMe, type Me } from '@/lib/api'
import { initDomain, registerAssets, taxonomyCount } from '@/lib/domain'

type Boot =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: Me; taxonomy: number; assets: number }

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMe()
        const { dataset } = await getBootstrap()
        initDomain(dataset)
        if (!cancelled) {
          setBoot({
            status: 'ready',
            me,
            taxonomy: taxonomyCount(),
            assets: registerAssets().length,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setBoot({ status: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      }
    })()
    // NOTE: `cancelled` suppresses the stale setState only; the in-flight fetch
    // and initDomain still run to completion and mutate shared module state —
    // fine while App is the only initDomain caller.
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 flex min-h-[62px] flex-wrap items-center gap-4 border-b border-border bg-card px-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-sm bg-primary" aria-hidden />
            <h1 className="text-sm font-semibold">Asset Onboarding — ISO 55001</h1>
          </div>
          {boot.status === 'ready' && (
            <>
              <span className="text-xs text-muted-foreground">
                <CountUp to={boot.taxonomy} duration={1} separator="," /> taxonomy nodes ·{' '}
                <CountUp to={boot.assets} duration={1} separator="," /> register assets
              </span>
              <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs">
                {boot.me.displayName} · {boot.me.role}
              </span>
            </>
          )}
        </header>

        <main className="mx-auto max-w-6xl p-5">
          {boot.status === 'loading' && <p className="text-muted-foreground">Loading register…</p>}
          {boot.status === 'error' && (
            <div className="mx-auto mt-10 max-w-lg">
              <Alert variant="destructive">
                <AlertTitle>Could not reach the server</AlertTitle>
                <AlertDescription>
                  {boot.message} — is the Express server running on :8080?
                </AlertDescription>
              </Alert>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}
          {boot.status === 'ready' && <RegisterTable assets={registerAssets()} />}
        </main>
      </div>
    </ErrorBoundary>
  )
}
