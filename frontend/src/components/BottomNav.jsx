import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic, Shield, Home as HomeIcon } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  
  const tabs = [
    { path: '/', label: 'Volunteer', icon: Mic },
    { path: '/ngo', label: 'NGO Panel', icon: Shield },
  ];

  return (
    <div className="md:w-24 md:h-full md:border-r md:border-slate-200 md:bg-white md:flex-shrink-0 absolute md:relative bottom-0 left-0 right-0 z-50">
      <div className="flex md:flex-col items-center justify-around md:justify-center md:space-y-8 glass-panel md:bg-transparent md:backdrop-blur-none md:border-none border-t border-white/30 py-2 md:py-8 px-4 md:h-full">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center space-y-1 px-4 py-2 md:py-4 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'text-primary md:bg-primary/5 scale-105' 
                  : 'text-slate-400 hover:text-slate-600 md:hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 md:w-6 md:h-6 ${isActive ? 'drop-shadow-md' : ''}`} />
              <span className={`text-[10px] md:text-xs font-bold tracking-wide text-center ${isActive ? '' : 'font-semibold'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-primary rounded-full mt-1"></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
