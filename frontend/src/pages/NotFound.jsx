import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
      <p className="text-slate-600 mb-6">Page not found.</p>
      <Link to="/" className="px-6 py-2 bg-primary text-white rounded-full font-medium">Go Home</Link>
    </div>
  );
}
