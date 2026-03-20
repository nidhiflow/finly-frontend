import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ForgotPassword() {
    const [step, setStep] = useState(1); // 1 = email, 2 = OTP + new password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const navigate = useNavigate();
    const otpRefs = useRef([]);

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    // Step 1: Send reset code
    const handleSendCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await authAPI.forgotPassword({ email });
            setStep(2);
            setTimer(300);
            setSuccess(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || '';
        setOtp(newOtp);
    };

    // Step 2: Reset password
    const handleReset = async () => {
        setError('');
        const code = otp.join('');
        if (code.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const data = await authAPI.resetPassword({ email, code, newPassword });
            setSuccess(data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const data = await authAPI.forgotPassword({ email });
            setTimer(300);
            setSuccess('New reset code sent!');
            setOtp(['', '', '', '', '', '']);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="auth-container">
            <div className="auth-card slide-up">
                <div className="auth-brand">
                    <img src="/finly-logo.png" alt="Finly" className="auth-brand-logo" />
                    <h1>Finly</h1>
                    <p>{step === 1 ? 'Reset your password' : 'Enter the reset code'}</p>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success">{success}</div>}

                {step === 1 ? (
                    <form className="auth-form" onSubmit={handleSendCode}>
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
                        <button className="btn btn-primary" type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Code'}
                        </button>
                    </form>
                ) : (
                    <div className="auth-form">
                        <p className="otp-info">Enter the code sent to <strong>{email}</strong> and set your new password</p>

                        <div className="otp-inputs" onPaste={handleOtpPaste}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => otpRefs.current[i] = el}
                                    type="text"
                                    inputMode="numeric"
                                    className="otp-input"
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    maxLength={1}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        {timer > 0 && (
                            <p className="otp-timer">Code expires in <strong>{formatTime(timer)}</strong></p>
                        )}

                        <div className="input-group">
                            <label className="input-label">New Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="Min. 6 characters"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Confirm Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                minLength={6}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={handleReset} disabled={loading}>
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>

                        <div className="otp-actions">
                            <button className="btn-link" onClick={handleResend} disabled={loading || timer > 270}>
                                Resend Code
                            </button>
                        </div>
                    </div>
                )}

                <div className="auth-footer">
                    Remember your password? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}
