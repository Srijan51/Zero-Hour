import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Save, Trash2, X, Search, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const STATUS_OPTIONS = ['open', 'matched', 'pending_confirmation', 'completed', 'cancelled'];

function toCsvText(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.join(', ');
}

function fromCsvText(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminRequestsHistory() {
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminAuthToken') || '');
  const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || '');
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [ngoFilter, setNgoFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [editingRequestId, setEditingRequestId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    ngo_name: '',
    task_description: '',
    required_skills: '',
    required_assets: '',
    location_text: '',
    lat: '',
    lng: '',
    urgency: 3,
    status: 'open',
  });

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [message, setMessage] = useState('');

  const authHeaders = useMemo(
    () => (adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    [adminToken]
  );

  const verifyAdmin = async () => {
    if (!adminToken) {
      navigate('/admin');
      return;
    }

    try {
      const res = await api.get('/admin/me', { headers: authHeaders });
      setAdminName(res.data.username);
      setCheckingAuth(false);
    } catch {
      localStorage.removeItem('adminAuthToken');
      localStorage.removeItem('adminName');
      setAdminToken('');
      navigate('/admin');
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (ngoFilter.trim()) params.ngo_name = ngoFilter.trim();

      const res = await api.get('/admin/requests', {
        headers: authHeaders,
        params,
      });
      setRequests(res.data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to load request history.';
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAdmin();
  }, [adminToken]);

  useEffect(() => {
    if (checkingAuth || !adminToken) return;
    fetchRequests();
  }, [checkingAuth, adminToken, statusFilter]);

  const startEdit = (req) => {
    setEditingRequestId(req.id);
    setEditDraft({
      ngo_name: req.ngo_name || '',
      task_description: req.task_description || '',
      required_skills: toCsvText(req.required_skills),
      required_assets: toCsvText(req.required_assets),
      location_text: req.location_text || '',
      lat: String(req.lat ?? ''),
      lng: String(req.lng ?? ''),
      urgency: Number(req.urgency ?? 3),
      status: req.status || 'open',
    });
  };

  const cancelEdit = () => {
    setEditingRequestId(null);
    setEditDraft({
      ngo_name: '',
      task_description: '',
      required_skills: '',
      required_assets: '',
      location_text: '',
      lat: '',
      lng: '',
      urgency: 3,
      status: 'open',
    });
  };

  const saveEdit = async (requestId) => {
    try {
      const payload = {
        ngo_name: editDraft.ngo_name.trim(),
        task_description: editDraft.task_description.trim(),
        required_skills: fromCsvText(editDraft.required_skills),
        required_assets: fromCsvText(editDraft.required_assets),
        location_text: editDraft.location_text.trim() || null,
        lat: Number(editDraft.lat),
        lng: Number(editDraft.lng),
        urgency: Number(editDraft.urgency),
        status: editDraft.status,
      };

      await api.put(`/admin/requests/${requestId}`, payload, { headers: authHeaders });
      setMessage('Request updated successfully.');
      cancelEdit();
      fetchRequests();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to update request.';
      setMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await api.delete(`/admin/requests/${pendingDeleteId}`, { headers: authHeaders });
      setMessage('Request deleted successfully.');
      setPendingDeleteId(null);
      fetchRequests();
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to delete request.';
      setMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  if (checkingAuth) {
    return (
      <div className="h-full w-full bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 pb-16 md:pb-0">
        <div className="text-sm text-slate-500 font-medium">Checking admin authentication...</div>
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
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Panel</span>
            </button>
            <h1 className="text-lg font-extrabold text-slate-800 mt-1">Request History Log</h1>
            <p className="text-xs text-slate-500">All NGO requests with admin edit and delete controls</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-bold text-slate-700">{adminName}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <input
              type="text"
              value={ngoFilter}
              onChange={(e) => setNgoFilter(e.target.value)}
              placeholder="Filter by NGO name"
              className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100 md:col-span-2"
            />

            <button
              type="button"
              onClick={fetchRequests}
              className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>

          {message && (
            <div className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              {message}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="text-center text-sm text-slate-500 py-6">Loading request history...</div>
          )}

          {!loading && requests.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-400">
              <History className="w-7 h-7 mx-auto mb-2" />
              <p className="text-sm font-semibold">No requests found for this filter.</p>
            </div>
          )}

          {!loading && requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              {editingRequestId === req.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.ngo_name} onChange={(e) => setEditDraft({ ...editDraft, ngo_name: e.target.value })} placeholder="NGO Name" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.task_description} onChange={(e) => setEditDraft({ ...editDraft, task_description: e.target.value })} placeholder="Task Description" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.required_skills} onChange={(e) => setEditDraft({ ...editDraft, required_skills: e.target.value })} placeholder="Required Skills (csv)" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.required_assets} onChange={(e) => setEditDraft({ ...editDraft, required_assets: e.target.value })} placeholder="Required Assets (csv)" />
                    <input type="text" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100 md:col-span-2" value={editDraft.location_text} onChange={(e) => setEditDraft({ ...editDraft, location_text: e.target.value })} placeholder="Location" />
                    <input type="number" step="any" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.lat} onChange={(e) => setEditDraft({ ...editDraft, lat: e.target.value })} placeholder="Latitude" />
                    <input type="number" step="any" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.lng} onChange={(e) => setEditDraft({ ...editDraft, lng: e.target.value })} placeholder="Longitude" />
                    <input type="number" min="1" max="5" className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100" value={editDraft.urgency} onChange={(e) => setEditDraft({ ...editDraft, urgency: Number(e.target.value || 3) })} placeholder="Urgency" />
                    <select value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })} className="w-full p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100">
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 mt-2">
                    <button onClick={() => saveEdit(req.id)} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button onClick={cancelEdit} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">#{req.id} - {req.ngo_name}</p>
                      <p className="text-xs text-slate-600 mt-1">{req.task_description}</p>
                      <p className="text-[11px] text-slate-400 mt-1">Status: {req.status} | Urgency: {req.urgency}</p>
                      <p className="text-[11px] text-slate-400">Location: {req.location_text || `${req.lat}, ${req.lng}`}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => startEdit(req)} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button onClick={() => setPendingDeleteId(req.id)} className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100">
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-[80] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-xl p-5 slide-up">
            <h3 className="text-base font-extrabold text-slate-800">Delete Request?</h3>
            <p className="mt-2 text-sm text-slate-500">This will permanently remove the request and its match records.</p>
            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
