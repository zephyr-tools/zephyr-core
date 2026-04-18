import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  pluginId: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PluginErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[Plugin:${this.props.pluginId}] render error:`, error, info.componentStack);
  }

  // Reset when the boundary is reused for a different plugin (e.g. route switch).
  override componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.pluginId !== this.props.pluginId) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-xs text-red-300">
          <span className="font-semibold">{this.props.pluginId}</span> failed to render:{' '}
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
