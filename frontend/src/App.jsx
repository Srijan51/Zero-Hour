import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NGOLogin from './pages/NGOLogin';
import NotFound from './pages/NotFound';

function App() {
  return (
    <div className="w-full h-full bg-slate-50 relative max-w-md mx-auto shadow-2xl overflow-hidden ring-1 ring-slate-200">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ngo" element={<NGOLogin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
