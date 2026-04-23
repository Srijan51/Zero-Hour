import { Link } from 'react-router-dom';
import { AlertTriangle, Home, Shield, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-secondary/5 rounded-full blur-3xl"></div>

      {/* Floating icon */}
      <div className="relative z-10 mb-6 float-anim">
        <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/5 border border-primary/10">
          <AlertTriangle className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      {/* Text */}
      <h1 className="relative z-10 text-7xl font-extrabold bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent tracking-tighter mb-2">
        404
      </h1>
      <p className="relative z-10 text-slate-500 text-lg font-semibold mb-1">Page Not Found</p>
      <p className="relative z-10 text-slate-400 text-sm max-w-[250px] mb-8 leading-relaxed">
        This route doesn't exist in the dispatch network. Head back to safety.
      </p>
      
      {/* Navigation buttons */}
      <div className="relative z-10 flex flex-col space-y-3 w-full max-w-[240px]">
        <Link 
          to="/" 
          className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          <Home className="w-4 h-4" />
          <span>Volunteer Hub</span>
        </Link>
        <Link 
          to="/ngo" 
          className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-white text-slate-700 rounded-xl font-bold shadow-sm border border-slate-100 transition-all hover:border-primary/30 hover:text-primary active:scale-95"
        >
          <Shield className="w-4 h-4" />
          <span>NGO Dashboard</span>
        </Link>
      </div>

      {/* Back link */}
      <button 
        onClick={() => window.history.back()} 
        className="relative z-10 mt-6 flex items-center space-x-1.5 text-sm text-slate-400 hover:text-primary transition-colors font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Go back</span>
      </button>
    </div>
  );
}
