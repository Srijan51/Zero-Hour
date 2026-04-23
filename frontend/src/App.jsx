import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import NGOLogin from './pages/NGOLogin';
import NotFound from './pages/NotFound';
import RegisterNGO from './pages/RegisterNGO';
import AdminPanel from './pages/AdminPanel';
import BottomNav from './components/BottomNav';

function App() {
  const location = useLocation();
  const showNav = location.pathname === '/' || location.pathname === '/ngo';

  return (
    <div className="w-full h-full bg-slate-50 relative max-w-md md:max-w-none mx-auto shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:shadow-none sm:rounded-[2.5rem] md:rounded-none sm:my-4 md:my-0 sm:h-[calc(100%-2rem)] md:h-full overflow-hidden ring-1 ring-slate-900/10 md:ring-0 transition-all flex flex-col md:flex-row">
      {showNav && <BottomNav />}
      <div className="flex-1 relative overflow-hidden h-full">
        <div key={location.pathname} className="page-enter h-full">
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ngo" element={<NGOLogin />} />
          <Route path="/register" element={<RegisterNGO />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
