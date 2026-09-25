import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class InfographicErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Infographic render failed', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-2xl border border-[#C5A059]/30 bg-[#1A1A1E] p-6 text-center text-[#E5E7EB]">
          <p>Не удалось отобразить график</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-lg border border-[#C5A059]/50 px-4 py-2 text-[#C5A059]"
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
