import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpStep, setOtpStep] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpMessage, setOtpMessage] = useState('');
    const { login, verifyLoginOtp } = useAuth();
    const navigate = useNavigate();

    const networkErrorMessage = 'Cannot reach server. Check your internet connection and try again.';
    const isNetworkError = (err) =>
        err?.message === 'Failed to fetch' ||
        err?.message === 'Request timed out' ||
        err?.name === 'TypeError';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await login(email, password);
            if (result.requireOTP) {
                setOtpStep(true);
                setOtpMessage(result.message);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(isNetworkError(err) ? networkErrorMessage : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await verifyLoginOtp(email, otpCode);
            navigate('/');
        } catch (err) {
            setError(isNetworkError(err) ? networkErrorMessage : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        try {
            await authAPI.resendOtp({ email, type: 'login' });
            setOtpMessage('A new verification code has been sent to your email.');
        } catch (err) {
            setError(isNetworkError(err) ? networkErrorMessage : err.message);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card slide-up">
                <div className="auth-brand">
                    <img src="/finly-logo.png" alt="Finly" className="auth-brand-logo" />
                    <h1>Finly</h1>
                    <p>Your personal finance companion</p>
                </div>

                {error && (
                    <div className="auth-error">
                        {error}
                        {error === networkErrorMessage && (
                            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setError('')}>
                                Retry
                            </button>
                        )}
                    </div>
                )}

                {!otpStep ? (
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                ) : (
                    <form className="auth-form" onSubmit={handleOtpSubmit}>
                        <div className="auth-otp-message" style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                            🔒 {otpMessage}
                        </div>
                        <div className="input-group">
                            <label className="input-label">Verification Code</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter 6-digit code"
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value)}
                                maxLength={6}
                                required
                                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify & Sign In'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={handleResendOtp} style={{ marginTop: 8, width: '100%' }}>
                            Resend Code
                        </button>
                    </form>
                )}

                <div className="auth-forgot">
                    <Link to="/forgot-password">Forgot Password?</Link>
                </div>

                <div className="auth-footer">
                    Don't have an account? <Link to="/signup">Sign Up</Link>
                </div>
            </div>
        </div>
    );
}
