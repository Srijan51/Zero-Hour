import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import NGOLogin from './pages/NGOLogin';
import NotFound from './pages/NotFound';
import RegisterNGO from './pages/RegisterNGO';
import AdminPanel from './pages/AdminPanel';
import AdminRequestsHistory from './pages/AdminRequestsHistory';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import UpdatePrompt from './components/UpdatePrompt';

function App() {
  const location = useLocation();
  const showNav = location.pathname === '/' || location.pathname === '/ngo';

  return (
    <div className="w-full h-full bg-slate-50 relative mx-auto overflow-hidden flex flex-col md:flex-row">
      {/* PWA Overlays */}
      <OfflineBanner />
      <UpdatePrompt />
      <InstallPrompt />

      {showNav && <BottomNav />}
      <div className="flex-1 relative overflow-hidden h-full">
        <div key={location.pathname} className="page-enter h-full">
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ngo" element={<NGOLogin />} />
          <Route path="/register" element={<RegisterNGO />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/requests" element={<AdminRequestsHistory />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
