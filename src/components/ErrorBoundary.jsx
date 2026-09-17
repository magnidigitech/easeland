import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('EaseLand Platform Error Boundary caught exception:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.setItem('easeland_active_page', 'home');
      // If site config was corrupted, remove cached version to force default re-hydration
      localStorage.removeItem('easeland_site_config');
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-charcoal text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-brand-yellow/10 text-brand-yellow rounded-2xl mx-auto flex items-center justify-center border border-brand-yellow/30 font-black text-2xl">
              !
            </div>
            <div>
              <h2 className="text-xl font-black text-white">EaseLand Platform Session Refresh</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed font-medium">
                Click below to reset your active session and return to the live homepage.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left text-[11px] font-mono text-red-300 break-words max-h-32 overflow-y-auto">
                <span className="font-bold text-red-400 block mb-1">Diagnostic Log:</span>
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-brand-yellow hover:bg-amber-400 text-brand-charcoal font-extrabold text-xs py-3.5 rounded-xl shadow-lg transition-all"
            >
              Return to Homepage & Reset Cache
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
