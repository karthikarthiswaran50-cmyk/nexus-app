import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { AppLayout } from './components/layout/AppLayout';
import { AuthModal } from './components/auth/AuthModal';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nexus App ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 text-2xl font-bold border border-rose-500/30">
            ⚠️
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-dark-400 max-w-sm mb-6 leading-relaxed">
            {this.state.errorMessage || 'An unexpected rendering error occurred. Click reload to refresh the application.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="py-2.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg transition-all"
          >
            Reload Nexus App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const PrivacyPolicyView = React.lazy(() => import('./components/legal/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfServiceView = React.lazy(() => import('./components/legal/TermsOfServiceView').then(m => ({ default: m.TermsOfServiceView })));
const AccountDeletionView = React.lazy(() => import('./components/legal/AccountDeletionView').then(m => ({ default: m.AccountDeletionView })));
const AboutUsView = React.lazy(() => import('./components/legal/AboutUsView').then(m => ({ default: m.AboutUsView })));
const ContactUsView = React.lazy(() => import('./components/legal/ContactUsView').then(m => ({ default: m.ContactUsView })));
const CommunityGuidelinesView = React.lazy(() => import('./components/legal/CommunityGuidelinesView').then(m => ({ default: m.CommunityGuidelinesView })));

type AppRoute = 'app' | 'privacy' | 'terms' | 'delete-account' | 'about' | 'contact' | 'community-guidelines';

const getInitialRoute = (): AppRoute => {
  if (typeof window === 'undefined') return 'app';
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const pageParam = search.get('page')?.toLowerCase();
  if (path === '/privacy' || path.startsWith('/privacy') || pageParam === 'privacy') return 'privacy';
  if (path === '/terms' || path.startsWith('/terms') || pageParam === 'terms') return 'terms';
  if (path === '/delete-account' || path.startsWith('/delete-account') || path === '/account-deletion' || pageParam === 'delete-account') return 'delete-account';
  if (path === '/about' || path.startsWith('/about') || pageParam === 'about') return 'about';
  if (path === '/contact' || path.startsWith('/contact') || pageParam === 'contact') return 'contact';
  if (path === '/community-guidelines' || path.startsWith('/community-guidelines') || pageParam === 'community-guidelines') return 'community-guidelines';
  return 'app';
};

const LazyRouteFallback = () => (
  <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-xs text-dark-400">Loading page...</p>
  </div>
);

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [route, setRoute] = React.useState<AppRoute>(getInitialRoute);

  React.useEffect(() => {
    const handlePopState = () => {
      setRoute(getInitialRoute());
    };
    const handleCustomNav = (e: any) => {
      const validRoutes: AppRoute[] = ['privacy', 'terms', 'delete-account', 'about', 'contact', 'community-guidelines', 'app'];
      if (validRoutes.includes(e.detail)) {
        setRoute(e.detail);
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('nexus_navigate', handleCustomNav);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('nexus_navigate', handleCustomNav);
    };
  }, []);

  const navigateToApp = () => {
    window.history.pushState({}, '', '/');
    setRoute('app');
  };

  if (route === 'about') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <AboutUsView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (route === 'contact') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <ContactUsView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (route === 'community-guidelines') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <CommunityGuidelinesView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (route === 'privacy') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <PrivacyPolicyView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (route === 'terms') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <TermsOfServiceView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (route === 'delete-account') {
    return (
      <React.Suspense fallback={<LazyRouteFallback />}>
        <AccountDeletionView onBack={navigateToApp} />
      </React.Suspense>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-dark-400 font-medium">Initializing Nexus Real-Time Platform...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <SocketProvider>
      <AppLayout />
    </SocketProvider>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
