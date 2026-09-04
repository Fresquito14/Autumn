import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md w-full bg-card border rounded-xl shadow-2xl p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Algo ha fallado</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Se ha producido un error inesperado en la interfaz. Los datos en local están a salvo.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-muted/60 p-3 rounded-md text-[11px] font-mono text-destructive overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <Button onClick={this.handleReset} className="w-full gap-2 font-semibold">
              <RefreshCw className="h-4 w-4" />
              Recargar Aplicación
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
