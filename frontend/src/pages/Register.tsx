import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('Password must be 8+ characters, with 1 uppercase letter and 1 number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created!');
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#0F1117]"
      style={{
        backgroundImage:
          'radial-gradient(circle, #2D3248 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '0 0',
      }}
    >
      <div className="w-full max-w-[440px] mx-4">
        <div className="bg-[#1A1D27] border border-[#2D3248] rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6366F1] mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#F1F5F9]">TaskFlow</h1>
            <p className="text-[#94A3B8] text-sm mt-1">Create your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#1A1D27] border border-[#2D3248] rounded-lg px-3 py-2.5 text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus:border-[#6366F1] focus:ring-3 focus:ring-[#6366F1]/15 transition-colors"
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1A1D27] border border-[#2D3248] rounded-lg px-3 py-2.5 text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus:border-[#6366F1] focus:ring-3 focus:ring-[#6366F1]/15 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1A1D27] border border-[#2D3248] rounded-lg px-3 py-2.5 text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus:border-[#6366F1] focus:ring-3 focus:ring-[#6366F1]/15 transition-colors"
                placeholder="••••••••"
                required
              />
              <p className="mt-1.5 text-xs text-[#94A3B8]">Min 8 chars, 1 uppercase, 1 number</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#2D3248]" />
            <span className="text-sm text-[#94A3B8]">or</span>
            <div className="flex-1 h-px bg-[#2D3248]" />
          </div>

          <p className="text-center text-sm text-[#94A3B8]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#6366F1] hover:text-[#4F46E5] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
