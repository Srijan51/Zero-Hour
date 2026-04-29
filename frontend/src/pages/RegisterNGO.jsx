import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function RegisterNGO() {
  const [formData, setFormData] = useState({
    ngo_name: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    certificate_80g_number: '',
    certificate_12a_number: '',
    password: '',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting registration...');
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/ngo/register', formData);
      setStatus('Registration submitted. Awaiting admin approval.');
      setFormData({
        ngo_name: '',
        email: '',
        phone: '',
        address: '',
        description: '',
        certificate_80g_number: '',
        certificate_12a_number: '',
        password: '',
      });
    } catch (err) {
      const backendDetail = err?.response?.data?.detail;
      const message = Array.isArray(backendDetail)
        ? backendDetail.map((item) => item?.msg || item).join(', ')
        : backendDetail;
      setStatus('');
      setError(message || 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full login-bg relative overflow-y-auto custom-scrollbar flex flex-col pb-16 md:pb-0 px-4 py-6">
      <div className="w-full max-w-2xl mx-auto">
        <Link to="/ngo" className="inline-flex items-center space-x-2 text-slate-500 hover:text-primary transition-colors text-sm font-semibold mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to NGO Login</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 slide-up">
          <div className="flex items-center space-x-3 mb-4">
            <img
              src="/logo.jpeg"
              alt="Zero Hour"
              className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-primary/20 border border-slate-100"
            />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">NGO Registration</h1>
              <p className="text-slate-500 text-xs font-medium">Apply for approval to access NGO Command</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NGO Name</label>
              <input
                required
                type="text"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={formData.ngo_name}
                onChange={e => setFormData({ ...formData, ngo_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</label>
                <input
                  required
                  type="email"
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                <input
                  type="text"
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</label>
              <input
                type="text"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">80G Certificate Number</label>
                <input
                  required
                  type="text"
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.certificate_80g_number}
                  onChange={e => setFormData({ ...formData, certificate_80g_number: e.target.value })}
                  placeholder="Enter 80G certificate number"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">12A Certificate Number</label>
                <input
                  required
                  type="text"
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  value={formData.certificate_12a_number}
                  onChange={e => setFormData({ ...formData, certificate_12a_number: e.target.value })}
                  placeholder="Enter 12A certificate number"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <textarea
                rows="3"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                required
                type="password"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isSubmitting ? 'Submitting...' : 'Submit Registration'}</span>
            </button>
          </form>

          {status && (
            <div className="mt-3 text-center text-sm font-semibold text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{status}</span>
            </div>
          )}

          {error && (
            <div className="mt-3 text-center text-sm font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
