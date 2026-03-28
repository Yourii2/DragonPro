import React from 'react';
import Swal from 'sweetalert2';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error: any | null };

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console and show a brief toast so the user sees something
    // Developers can check browser console for full stack.
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info);
    try {
      Swal.fire({ icon: 'error', title: 'Runtime error', text: String(error?.message || error) });
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white p-6 rounded-lg shadow text-center max-w-xl">
            <h2 className="text-xl font-bold mb-2">حدث خطأ أثناء التحميل</h2>
            <p className="text-sm text-muted mb-4">راجع وحدة التحكم في المتصفح لمزيد من التفاصيل.</p>
            <pre className="text-xs text-left p-2 bg-slate-50 rounded" style={{whiteSpace:'pre-wrap'}}>{String(this.state.error || '')}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
