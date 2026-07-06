import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-16 max-w-lg">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{this.state.error.message}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
