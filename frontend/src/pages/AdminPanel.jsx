import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, UserPlus, CheckCircle2, XCircle, Pencil, Save, X, ArrowLeft, Info, History, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ADMIN_TOAST_SESSION_KEY = 'adminSessionToast';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminAuthToken') || '');
  const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || '');
  const [toast, setToast] = useState(() => {
    try {
      const raw = sessionStorage.getItem(ADMIN_TOAST_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [registrations, setRegistrations] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [pendingDeleteNgo, setPendingDeleteNgo] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [newNgo, setNewNgo] = useState({
    ngo_name: '',
    email: '',
    phone: '',
    address: '',
    certificate_80g_number: '',
    certificate_12a_number: '',
    description: '',
    password: '',
  });

  const [editingNgoId, setEditingNgoId] = useState(null);
  const [editNgo, setEditNgo] = useState({
    ngo_name: '',
    email: '',
    phone: '',
    address: '',
    certificate_80g_number: '',
    certificate_12a_number: '',
    description: '',
    password: '',
    is_active: true,
  });

  const showToast = (message, type = 'info') => {
    const value = { message, type, timestamp: Date.now() };
    setToast(value);
    sessionStorage.setItem(ADMIN_TOAST_SESSION_KEY, JSON.stringify(value));
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => {
      setToast(null);
      sessionStorage.removeItem(ADMIN_TOAST_SESSION_KEY);
    }, 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const authHeaders = useMemo(
    () => (adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    [adminToken]
  );

  const fetchData = async ({ silent = false } = {}) => {
    if (!adminToken) return;
    if (!silent) setIsFetchingData(true);
    try {
      const [regRes, ngoRes] = await Promise.all([
        api.get('/admin/registrations?status=pending', { headers: authHeaders }),
        api.get('/admin/ngos', { headers: authHeaders }),
      ]);
      setRegistrations(regRes.data);
      setNgos(ngoRes.data);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleLogout();
        showToast('Session expired. Please login again.', 'error');
      }
    } finally {
      if (!silent) setIsFetchingData(false);
    }
  };

  useEffect(() => {
    const verify = async () => {
      if (!adminToken) return;
      try {
        const res = await api.get('/admin/me', { headers: authHeaders });
        setAdminName(res.data.username);
        localStorage.setItem('adminName', res.data.username);
        fetchData();
      } catch (err) {
        handleLogout();
        showToast('Admin session invalid. Please login again.', 'error');
      }
    };
    verify();
  }, [adminToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const res = await api.post('/admin/login', credentials);
      setAdminToken(res.data.token);
      setAdminName(res.data.username);
      localStorage.setItem('adminAuthToken', res.data.token);
      localStorage.setItem('adminName', res.data.username);
      setCredentials({ username: '', password: '' });
      showToast('Admin login successful.', 'success');
    } catch (err) {
      showToast('Invalid admin credentials', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('adminName');
    setAdminToken('');
    setAdminName('');
    setRegistrations([]);
    setNgos([]);
    setIsFetchingData(false);
  };

  const approveRegistration = async (registrationId) => {
    setPendingAction(`approve-${registrationId}`);
    try {
      await api.post(`/admin/registrations/${registrationId}/approve`, {}, { headers: authHeaders });
      showToast('Registration approved and NGO account created.', 'success');
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to approve registration', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const rejectRegistration = async (registrationId) => {
    setPendingAction(`reject-${registrationId}`);
    try {
      await api.post(`/admin/registrations/${registrationId}/reject`, {}, { headers: authHeaders });
      showToast('Registration rejected.', 'success');
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to reject registration', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const createNgoDirectly = async (e) => {
    e.preventDefault();
    setPendingAction('create-ngo');

    try {
      await api.post('/admin/ngos', newNgo, { headers: authHeaders });
      setNewNgo({ ngo_name: '', email: '', phone: '', address: '', certificate_80g_number: '', certificate_12a_number: '', description: '', password: '' });
      showToast('NGO account created successfully.', 'success');
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to create NGO', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDeleteNgo = async () => {
    if (!pendingDeleteNgo?.id) return;
    setPendingAction(`delete-ngo-${pendingDeleteNgo.id}`);
    try {
      await api.delete(`/admin/ngos/${pendingDeleteNgo.id}`, { headers: authHeaders });
      showToast('NGO account deleted.', 'success');
      setPendingDeleteNgo(null);
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to delete NGO', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const startEditNgo = (ngo) => {
    setEditingNgoId(ngo.id);
    setEditNgo({
      ngo_name: ngo.ngo_name || '',
      email: ngo.email || '',
      phone: ngo.phone || '',
      address: ngo.address || '',
      certificate_80g_number: ngo.certificate_80g_number || '',
      certificate_12a_number: ngo.certificate_12a_number || '',
      description: ngo.description || '',
      password: '',
      is_active: Boolean(ngo.is_active),
    });
  };

  const cancelEditNgo = () => {
    setEditingNgoId(null);
    setEditNgo({
      ngo_name: '',
      email: '',
      phone: '',
      address: '',
      certificate_80g_number: '',
      certificate_12a_number: '',
      description: '',
      password: '',
      is_active: true,
    });
  };

  const saveNgoEdit = async (ngoId) => {
    setPendingAction(`save-ngo-${ngoId}`);
    try {
      const payload = {
        ngo_name: editNgo.ngo_name,
        email: editNgo.email,
        phone: editNgo.phone,
        address: editNgo.address,
        certificate_80g_number: editNgo.certificate_80g_number,
        certificate_12a_number: editNgo.certificate_12a_number,
        description: editNgo.description,
        is_active: editNgo.is_active,
      };

      if (editNgo.password.trim()) {
        payload.password = editNgo.password.trim();
      }

      await api.put(`/admin/ngos/${ngoId}`, payload, { headers: authHeaders });
      cancelEditNgo();
      showToast('NGO details updated.', 'success');
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to update NGO', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  if (!adminToken) {
    return (
      <div className="h-full w-full login-bg relative overflow-y-auto custom-scrollbar flex flex-col items-center justify-center px-4 pb-16 md:pb-0">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 slide-up">
          <button
            type="button"
            onClick={() => navigate('/ngo')}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-primary transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to NGO Panel</span>
          </button>

          <div className="mb-4">
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Admin Access</h1>
            <p className="text-slate-500 text-xs font-medium">Site administrator only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
              <input
                required
                type="text"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={credentials.username}
                onChange={e => setCredentials({ ...credentials, username: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                required
                type="password"
                className="w-full mt-1 p-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                value={credentials.password}
                onChange={e => setCredentials({ ...credentials, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 mt-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary disabled:opacity-75 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center space-x-2"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{isLoggingIn ? 'Logging in...' : 'Login as Admin'}</span>
            </button>
          </form>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-[70]">
            <div className={`max-w-sm px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold flex items-center space-x-2 ${
              toast.type === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-100'
                : toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <Info className="w-4 h-4" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full panel-bg relative overflow-y-auto custom-scrollbar px-4 py-6 pb-16 md:pb-6 fade-in">
      <div className="max-w-6xl mx-auto space-y-4 slide-up">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/logo.jpeg"
              alt="Zero Hour"
              className="w-11 h-11 rounded-xl object-cover shadow-sm border border-slate-100"
            />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Admin Panel</h1>
              <p className="text-xs text-slate-500">Signed in as {adminName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => navigate('/admin/requests')}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              {isFetchingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
              <span>Request History</span>
            </button>
            <button onClick={handleLogout} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-700">Pending NGO Registrations</h2>
              {isFetchingData && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {isFetchingData && registrations.length === 0 && (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-xs font-medium">Loading pending registrations...</p>
                </div>
              )}
              {!isFetchingData && registrations.length === 0 && <p className="text-xs text-slate-400">No pending registrations.</p>}
              {registrations.map(reg => (
                <div key={reg.id} className="p-3 border border-slate-100 rounded-xl">
                  <p className="text-sm font-bold text-slate-800">{reg.ngo_name}</p>
                  <p className="text-xs text-slate-500">{reg.email}</p>
                  <p className="text-xs text-slate-500 mt-1">80G: {reg.certificate_80g_number || 'Not provided'}</p>
                  <p className="text-xs text-slate-500">12A: {reg.certificate_12a_number || 'Not provided'}</p>
                  <p className="text-xs text-slate-500 mt-1">{reg.description || 'No description'}</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <button onClick={() => approveRegistration(reg.id)} disabled={pendingAction === `approve-${reg.id}`} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 disabled:opacity-75 disabled:cursor-not-allowed">
                      {pendingAction === `approve-${reg.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span>{pendingAction === `approve-${reg.id}` ? 'Approving...' : 'Approve'}</span>
                    </button>
                    <button onClick={() => rejectRegistration(reg.id)} disabled={pendingAction === `reject-${reg.id}`} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100 disabled:opacity-75 disabled:cursor-not-allowed">
                      {pendingAction === `reject-${reg.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      <span>{pendingAction === `reject-${reg.id}` ? 'Rejecting...' : 'Reject'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Add NGO Directly</h2>
            <form onSubmit={createNgoDirectly} className="space-y-2">
              <input required type="text" placeholder="NGO Name" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.ngo_name} onChange={e => setNewNgo({ ...newNgo, ngo_name: e.target.value })} />
              <input required type="email" placeholder="Email" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.email} onChange={e => setNewNgo({ ...newNgo, email: e.target.value })} />
              <input type="text" placeholder="Phone" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.phone} onChange={e => setNewNgo({ ...newNgo, phone: e.target.value })} />
              <input type="text" placeholder="Address" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.address} onChange={e => setNewNgo({ ...newNgo, address: e.target.value })} />
              <input required type="text" placeholder="80G Certificate Number" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.certificate_80g_number} onChange={e => setNewNgo({ ...newNgo, certificate_80g_number: e.target.value })} />
              <input required type="text" placeholder="12A Certificate Number" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.certificate_12a_number} onChange={e => setNewNgo({ ...newNgo, certificate_12a_number: e.target.value })} />
              <textarea placeholder="Description" rows="2" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.description} onChange={e => setNewNgo({ ...newNgo, description: e.target.value })} />
              <input required type="password" placeholder="Password" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={newNgo.password} onChange={e => setNewNgo({ ...newNgo, password: e.target.value })} />
              <button type="submit" disabled={pendingAction === 'create-ngo'} className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center justify-center space-x-1 disabled:opacity-75 disabled:cursor-not-allowed">
                {pendingAction === 'create-ngo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{pendingAction === 'create-ngo' ? 'Creating...' : 'Create NGO'}</span>
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-700">Registered NGOs</h2>
              {isFetchingData && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          <div className="space-y-2">
              {isFetchingData && ngos.length === 0 && (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-xs font-medium">Loading registered NGOs...</p>
                </div>
              )}
            {ngos.map(ngo => (
              <div key={ngo.id} className="p-3 border border-slate-100 rounded-xl">
                {editingNgoId === ngo.id ? (
                  <div className="space-y-2">
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.ngo_name} onChange={e => setEditNgo({ ...editNgo, ngo_name: e.target.value })} placeholder="NGO Name" />
                    <input type="email" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.email} onChange={e => setEditNgo({ ...editNgo, email: e.target.value })} placeholder="Email" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.phone} onChange={e => setEditNgo({ ...editNgo, phone: e.target.value })} placeholder="Phone" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.address} onChange={e => setEditNgo({ ...editNgo, address: e.target.value })} placeholder="Address" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.certificate_80g_number} onChange={e => setEditNgo({ ...editNgo, certificate_80g_number: e.target.value })} placeholder="80G Certificate Number" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.certificate_12a_number} onChange={e => setEditNgo({ ...editNgo, certificate_12a_number: e.target.value })} placeholder="12A Certificate Number" />
                    <textarea rows="2" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.description} onChange={e => setEditNgo({ ...editNgo, description: e.target.value })} placeholder="Description" />
                    <input type="password" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editNgo.password} onChange={e => setEditNgo({ ...editNgo, password: e.target.value })} placeholder="New password (optional)" />
                    <label className="inline-flex items-center space-x-2 text-xs text-slate-600 font-semibold">
                      <input type="checkbox" checked={editNgo.is_active} onChange={e => setEditNgo({ ...editNgo, is_active: e.target.checked })} />
                      <span>Active account</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => saveNgoEdit(ngo.id)} disabled={pendingAction === `save-ngo-${ngo.id}`} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 disabled:opacity-75 disabled:cursor-not-allowed">
                        {pendingAction === `save-ngo-${ngo.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>{pendingAction === `save-ngo-${ngo.id}` ? 'Saving...' : 'Save'}</span>
                      </button>
                      <button onClick={cancelEditNgo} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{ngo.ngo_name}</p>
                      <p className="text-xs text-slate-500">{ngo.email}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{ngo.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => startEditNgo(ngo)} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button onClick={() => setPendingDeleteNgo({ id: ngo.id, name: ngo.ngo_name })} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-[70]">
          <div className={`max-w-sm px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold flex items-center space-x-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-100'
              : toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            <Info className="w-4 h-4" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {pendingDeleteNgo && (
        <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-xl p-5 slide-up">
            <h3 className="text-base font-extrabold text-slate-800">Delete NGO Account?</h3>
            <p className="mt-2 text-sm text-slate-500">
              You are deleting <span className="font-semibold text-slate-700">{pendingDeleteNgo.name}</span>. Associated requests and active sessions will also be removed.
            </p>
            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPendingDeleteNgo(null)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteNgo}
                disabled={pendingAction === `delete-ngo-${pendingDeleteNgo.id}`}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-75 disabled:cursor-not-allowed inline-flex items-center space-x-2"
              >
                {pendingAction === `delete-ngo-${pendingDeleteNgo.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{pendingAction === `delete-ngo-${pendingDeleteNgo.id}` ? 'Deleting...' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
