import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your phone number, username, or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Registration flow
        const cleanFullName = fullName.trim() || cleanIdentifier.split('@')[0];
        const isEmail = cleanIdentifier.includes('@');
        const cleanEmail = isEmail
          ? cleanIdentifier
          : `${cleanIdentifier.toLowerCase().replace(/[^a-z0-9_]/g, '')}@nexusroyal.online`;
        const cleanUsername = isEmail
          ? cleanIdentifier.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
          : cleanIdentifier.toLowerCase().replace(/[^a-z0-9_]/g, '');

        await register({
          email: cleanEmail,
          username: cleanUsername || 'user_' + Date.now().toString(36),
          full_name: cleanFullName,
          password,
        });
      } else {
        // Direct Login flow
        await login(cleanIdentifier, password);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      const serverErr = err.response?.data?.error || err.message || 'Authentication failed. Please check your credentials.';
      setError(serverErr);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err?.code === 'auth/popup-blocked') {
        setError('Google pop-up was blocked by browser. Please log in with username/email and password above.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google Sign-In was cancelled.');
      } else {
        setError(err.message || 'Google Sign-In could not complete. You can log in with username and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nexus-auth-wrapper">
      <style>{`
        .nexus-auth-wrapper {
          margin: 0;
          min-height: 100vh;
          width: 100vw;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #a0339e, #d62976);
          font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 16px;
          box-sizing: border-box;
        }
        .nexus-auth-wrapper .box {
          background: #fff;
          width: 340px;
          max-width: 100%;
          padding: 30px 24px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          box-sizing: border-box;
          animation: nexusFadeIn 0.3s ease-out;
        }
        @keyframes nexusFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .nexus-auth-wrapper .logo {
          font-size: 34px;
          font-weight: bold;
          background: linear-gradient(45deg, #fa7e1e, #d62976);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }
        .nexus-auth-wrapper input {
          width: 100%;
          padding: 11px;
          margin: 6px 0;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-sizing: border-box;
          outline: none;
          font-size: 14px;
          color: #222;
          background-color: #fafafa;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .nexus-auth-wrapper input:focus {
          border-color: #d62976;
          background-color: #fff;
          box-shadow: 0 0 0 2px rgba(214, 41, 118, 0.15);
        }
        .nexus-auth-wrapper .btn {
          width: 100%;
          padding: 11px;
          margin-top: 12px;
          background: linear-gradient(90deg, #ff4e50, #f9d423);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
          transition: opacity 0.2s, transform 0.1s;
        }
        .nexus-auth-wrapper .btn:hover:not(:disabled) {
          opacity: 0.95;
        }
        .nexus-auth-wrapper .btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .nexus-auth-wrapper .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .nexus-auth-wrapper .divider {
          margin: 18px 0;
          color: #999;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .nexus-auth-wrapper .divider::before,
        .nexus-auth-wrapper .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        .nexus-auth-wrapper .gbtn {
          width: 100%;
          padding: 10px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          color: #333;
          transition: background-color 0.2s, border-color 0.2s;
        }
        .nexus-auth-wrapper .gbtn:hover:not(:disabled) {
          background-color: #f8f8f8;
          border-color: #ccc;
        }
        .nexus-auth-wrapper .gbtn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .nexus-auth-wrapper .gbtn img {
          width: 18px !important;
          height: 18px !important;
          object-fit: contain;
        }
      `}</style>

      <div className="box">
        <div className="logo">NexusRoyal</div>
        <p style={{ color: '#888', fontSize: '11px', letterSpacing: '2px', marginTop: '2px', fontWeight: 600 }}>OFFICIAL</p>

        {error && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#e11d48',
            fontSize: '12px',
            padding: '8px 10px',
            borderRadius: '8px',
            margin: '10px 0 6px 0',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '8px' }}>
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              autoComplete="name"
            />
          )}

          <input
            type="text"
            placeholder={isSignUp ? "Username or Email" : "Phone number, username, or email"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
            autoComplete="username"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Please wait...' : (isSignUp ? 'Sign up for NexusRoyal' : 'Log in to NexusRoyal')}
          </button>
        </form>

        <div className="divider">OR</div>

        <button type="button" className="gbtn" onClick={handleGoogleSignIn} disabled={loading}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" />
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>

        {/* Toggle between Login and Sign Up */}
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
          {isSignUp ? (
            <>
              Have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); }}
                style={{ color: '#d62976', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(null); }}
                style={{ color: '#d62976', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Sign up
              </button>
            </>
          )}
        </div>

        {/* Terms and Privacy policy footer */}
        <div style={{ marginTop: '14px', fontSize: '10px', color: '#aaa', lineHeight: '1.4' }}>
          By continuing, you agree to our{' '}
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/terms');
              window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'terms' }));
            }}
            style={{ color: '#888', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
          >
            Terms of Service
          </button>
          {' '}and{' '}
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/privacy');
              window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'privacy' }));
            }}
            style={{ color: '#888', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
          >
            Privacy Policy
          </button>
          .
        </div>
      </div>
    </div>
  );
};
