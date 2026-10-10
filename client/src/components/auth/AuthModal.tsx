import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { login, register, loginWithGoogle, instantEmailLogin } = useAuth();
  const [authMode, setAuthMode] = useState<'instant' | 'login' | 'signup'>('instant');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Fields for Instant 1-Tap Access (No Password Required)
  const [instantEmail, setInstantEmail] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email') || params.get('u') || params.get('account') || params.get('login');
      if (urlEmail && urlEmail.includes('@')) return urlEmail.trim().toLowerCase();
      return localStorage.getItem('nexus_last_email') || '';
    } catch {
      return '';
    }
  });
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const savedLastEmail = typeof window !== 'undefined' ? localStorage.getItem('nexus_last_email') : null;
  
  // Fields for Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Fields for Sign Up (Set User ID & Password)
  const [desiredUserId, setDesiredUserId] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');

  // Fields for Password Reset
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetEmailOrKey, setResetEmailOrKey] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-login if URL contains an email query parameter (e.g. from Facebook or promotional links)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email') || params.get('u') || params.get('account') || params.get('login');
      if (urlEmail && urlEmail.includes('@')) {
        const cleanEmail = urlEmail.trim().toLowerCase();
        setAutoLoggingIn(true);
        setLoading(true);
        instantEmailLogin(cleanEmail)
          .catch((err: any) => {
            console.error('Seamless auto-login error:', err);
            setError(err?.response?.data?.error || 'Auto-login failed. Tap below to log in directly.');
          })
          .finally(() => {
            setAutoLoggingIn(false);
            setLoading(false);
          });
      }
    } catch (e) {
      console.warn('URL auto-login inspection error:', e);
    }
  }, []);

  const handleInstantLogin = async (targetEmail: string) => {
    setError(null);
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await instantEmailLogin(cleanEmail);
    } catch (err: any) {
      console.error('Instant email login error:', err);
      const serverErr =
        err.response?.data?.error ||
        err.message ||
        'Failed to log in. Please try again.';
      setError(serverErr);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your User ID, username, or email.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanIdentifier, loginPassword);
    } catch (err: any) {
      console.error('Authentication error:', err);
      const serverErr =
        err.response?.data?.error ||
        err.message ||
        'Authentication failed. Invalid User ID or password.';
      setError(serverErr);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUserId = desiredUserId.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUserId) {
      setError('Please choose your User ID.');
      return;
    }
    if (cleanUserId.length < 3) {
      setError('User ID must be at least 3 characters.');
      return;
    }
    if (cleanUserId.length > 30) {
      setError('User ID must not exceed 30 characters.');
      return;
    }
    if (!signUpPassword) {
      setError('Please set a password.');
      return;
    }
    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = optionalEmail.trim()
        ? optionalEmail.trim().toLowerCase()
        : `${cleanUserId}@nexusroyal.online`;

      await register({
        username: cleanUserId,
        password: signUpPassword,
        email: cleanEmail,
        full_name: cleanUserId,
      });
    } catch (err: any) {
      console.error('Sign-up error:', err);
      const serverErr =
        err.response?.data?.error ||
        err.message ||
        'Failed to set User ID and password. Please try a different User ID.';
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
        setError('Google pop-up was blocked by browser. Please log in with User ID and password above.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google Sign-In was cancelled.');
      } else {
        setError(err.message || 'Google Sign-In could not complete. You can log in with User ID and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);

    const cleanId = resetIdentifier.trim();
    if (!cleanId) {
      setError('Please enter your User ID, username, or email.');
      return;
    }
    const cleanKey = resetEmailOrKey.trim();
    if (!cleanKey) {
      setError('Please enter your registered email or the Master Recovery Key (nexusroyal2026).');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password-reset', {
        identifier: cleanId,
        emailOrKey: cleanKey,
        newPassword: resetNewPassword,
      });

      setResetSuccess(res.data?.message || 'Password reset successful! You can now log in.');
      setLoginIdentifier(cleanId);
      setLoginPassword(resetNewPassword);
      setTimeout(() => {
        setShowForgotPassword(false);
        setAuthMode('login');
        setResetSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error('Password reset error:', err);
      const serverErr =
        err.response?.data?.error ||
        err.message ||
        'Failed to reset password. Please check your credentials or contact Admin.';
      setError(serverErr);
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
          width: 350px;
          max-width: 100%;
          padding: 28px 24px;
          border-radius: 14px;
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
          line-height: 1.1;
        }
        .nexus-auth-wrapper .tab-row {
          display: flex;
          background: #f1f2f6;
          border-radius: 9px;
          padding: 3px;
          margin: 16px 0 12px 0;
          gap: 3px;
        }
        .nexus-auth-wrapper .tab-btn {
          flex: 1;
          padding: 8px 4px;
          font-size: 12px;
          font-weight: bold;
          border: none;
          background: transparent;
          border-radius: 7px;
          color: #777;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nexus-auth-wrapper .tab-btn.active {
          background: #fff;
          color: #d62976;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        .nexus-auth-wrapper input {
          width: 100%;
          padding: 11px 12px;
          margin: 5px 0;
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
          margin-top: 10px;
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
          margin: 16px 0;
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
        .nexus-auth-wrapper .quick-chip-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: #fdf2f8;
          border: 1.5px solid #f472b6;
          border-radius: 9px;
          color: #831843;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin: 8px 0 10px 0;
          transition: all 0.2s ease;
          box-sizing: border-box;
          text-align: left;
        }
        .nexus-auth-wrapper .quick-chip-btn:hover:not(:disabled) {
          background: #fce7f3;
          border-color: #ec4899;
          transform: translateY(-1px);
        }
        .nexus-auth-wrapper .quick-chip-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .nexus-auth-wrapper .tap-badge {
          background: #db2777;
          color: #fff;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 700;
          flex-shrink: 0;
          margin-left: 6px;
        }
      `}</style>

      <div className="box">
        <div className="logo">NexusRoyal</div>
        <p style={{ color: '#888', fontSize: '11px', letterSpacing: '2px', marginTop: '2px', fontWeight: 600 }}>
          {showForgotPassword ? 'ACCOUNT RECOVERY' : 'OFFICIAL'}
        </p>

        {showForgotPassword ? (
          /* ================= FORGOT PASSWORD FORM ================= */
          <div style={{ marginTop: '12px' }}>
            <div style={{
              background: '#fdf2f8',
              border: '1px solid #fbcfe8',
              color: '#9d174d',
              fontSize: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '10px',
              textAlign: 'left',
              lineHeight: '1.4'
            }}>
              🔑 <strong>Forgot Password?</strong> Enter your User ID or email, and either your registered email or the Master Recovery Key (<code>nexusroyal2026</code>) to set a new password.
            </div>

            {error && (
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                fontSize: '12px',
                padding: '8px 10px',
                borderRadius: '8px',
                margin: '8px 0',
                textAlign: 'left',
                lineHeight: '1.4'
              }}>
                {error}
              </div>
            )}

            {resetSuccess && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '12px',
                padding: '8px 10px',
                borderRadius: '8px',
                margin: '8px 0',
                textAlign: 'left',
                fontWeight: 600,
              }}>
                ✓ {resetSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} style={{ marginTop: '6px' }}>
              <input
                type="text"
                placeholder="User ID, username, or email"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />

              <input
                type="text"
                placeholder="Registered Email or Master Key (nexusroyal2026)"
                value={resetEmailOrKey}
                onChange={(e) => setResetEmailOrKey(e.target.value)}
                disabled={loading}
                required
              />

              <input
                type="password"
                placeholder="New Password (min 6 characters)"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                disabled={loading}
                required
              />

              <button type="submit" className="btn" disabled={loading}>
                {loading ? 'Resetting password...' : 'Reset Password & Proceed'}
              </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setAuthMode('login');
                  setError(null);
                  setResetSuccess(null);
                }}
                style={{
                  color: '#d62976',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ← Back to Log In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab row for switching between 1-Tap Access, Login, and Set User ID */}
            <div className="tab-row">
              <button
                type="button"
                className={`tab-btn ${authMode === 'instant' ? 'active' : ''}`}
                onClick={() => { setAuthMode('instant'); setError(null); }}
              >
                ⚡ 1-Tap Access
              </button>
              <button
                type="button"
                className={`tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setError(null); }}
              >
                User ID & Pass
              </button>
              <button
                type="button"
                className={`tab-btn ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setAuthMode('signup'); setError(null); }}
              >
                New Account
              </button>
            </div>

            {error && (
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                fontSize: '12px',
                padding: '8px 10px',
                borderRadius: '8px',
                margin: '8px 0',
                textAlign: 'left',
                lineHeight: '1.4'
              }}>
                {error}
              </div>
            )}

            {authMode === 'instant' && (
              /* ================= 1-TAP INSTANT ACCESS FORM ================= */
              <div style={{ marginTop: '4px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)',
                  border: '1px solid #fbcfe8',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '10px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: '#4c1d95',
                  lineHeight: '1.4'
                }}>
                  ✨ <strong>Instant Access:</strong> Enter or tap your email to enter directly. No password required!
                </div>

                {savedLastEmail && (
                  <button
                    type="button"
                    onClick={() => handleInstantLogin(savedLastEmail)}
                    className="quick-chip-btn"
                    disabled={loading}
                    title="Tap to log in instantly"
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      👤 Tap to continue as <strong>{savedLastEmail}</strong>
                    </span>
                    <span className="tap-badge">1-Tap ➔</span>
                  </button>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleInstantLogin(instantEmail); }} style={{ marginTop: '4px' }}>
                  <input
                    type="email"
                    placeholder="Enter your email (e.g. name@gmail.com)"
                    value={instantEmail}
                    onChange={(e) => setInstantEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    autoFocus={!savedLastEmail}
                    required
                  />

                  <button type="submit" className="btn" disabled={loading || !instantEmail.trim()}>
                    {loading ? (autoLoggingIn ? '⚡ Auto-Logging in...' : 'Entering Nexus...') : '⚡ Enter NexusRoyal (Direct Login)'}
                  </button>
                </form>
              </div>
            )}

            {authMode === 'login' && (
              /* ================= LOGIN FORM ================= */
              <form onSubmit={handleLoginSubmit} style={{ marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="User ID, username, or email"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />

                {/* Forgot Password Link */}
                <div style={{ textAlign: 'right', marginTop: '2px', marginBottom: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError(null);
                      setResetSuccess(null);
                      if (loginIdentifier) setResetIdentifier(loginIdentifier);
                    }}
                    style={{
                      color: '#d62976',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 0',
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Logging in...' : 'Log in with Password'}
                </button>
              </form>
            )}

            {authMode === 'signup' && (
              /* ================= SIGN UP / SET USER ID & PASSWORD ================= */
              <form onSubmit={handleSignUpSubmit} style={{ marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="Choose your User ID (e.g. karthik_01)"
                  value={desiredUserId}
                  onChange={(e) => setDesiredUserId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  required
                />

                <input
                  type="password"
                  placeholder="Set Password (min 6 characters)"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  required
                />

                <input
                  type="email"
                  placeholder="Email (optional for account recovery)"
                  value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Creating account...' : 'Set User ID & Open App'}
                </button>
              </form>
            )}

            <div className="divider">OR</div>

            <button type="button" className="gbtn" onClick={handleGoogleSignIn} disabled={loading}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>

            {/* Quick helper toggle */}
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#666', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {authMode !== 'instant' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('instant'); setError(null); }}
                  style={{ color: '#d62976', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ⚡ 1-Tap Login
                </button>
              )}
              {authMode !== 'instant' && authMode !== 'login' && <span>•</span>}
              {authMode !== 'login' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setError(null); }}
                  style={{ color: '#d62976', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  User ID & Password
                </button>
              )}
              {authMode !== 'signup' && <span>•</span>}
              {authMode !== 'signup' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(null); }}
                  style={{ color: '#d62976', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  New Account
                </button>
              )}
            </div>
          </>
        )}

        {/* Terms, Privacy, About, and Contact policy footer */}
        <div style={{ marginTop: '14px', fontSize: '10px', color: '#888', lineHeight: '1.6' }}>
          <div>By continuing, you agree to our{' '}
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/terms');
                window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'terms' }));
              }}
              style={{ color: '#d62976', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
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
              style={{ color: '#d62976', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
            >
              Privacy Policy
            </button>
            .
          </div>
          <div style={{ marginTop: '4px', color: '#999' }}>
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/about');
                window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'about' }));
              }}
              style={{ color: '#666', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
            >
              About Us
            </button>
            {' • '}
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/contact');
                window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'contact' }));
              }}
              style={{ color: '#666', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
            >
              Contact Us
            </button>
            {' • '}
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/community-guidelines');
                window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: 'community-guidelines' }));
              }}
              style={{ color: '#666', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '10px' }}
            >
              Community Guidelines
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
