import React from 'react';
import { MapPin, Radio } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '100%'
};

// Simulated NGO positions around Kolkata for the visual fallback
const SIMULATED_POINTS = [
  { id: 1, x: '25%', y: '30%', label: 'Red Cross', pulse: true },
  { id: 2, x: '60%', y: '20%', label: 'MSF', pulse: false },
  { id: 3, x: '45%', y: '55%', label: 'UNICEF', pulse: true },
  { id: 4, x: '75%', y: '45%', label: 'Oxfam', pulse: false },
  { id: 5, x: '30%', y: '70%', label: 'Goonj', pulse: true },
  { id: 6, x: '65%', y: '75%', label: 'Care India', pulse: false },
  { id: 7, x: '15%', y: '50%', label: 'Hope', pulse: true },
  { id: 8, x: '85%', y: '25%', label: 'Rotary', pulse: false },
];

export default function MapView({ userLat, userLng, markerData }) {
  // Check if Google Maps API key is available
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // If no API key, render our beautiful custom map fallback
  if (!apiKey) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 map-grid relative overflow-hidden">
        {/* Decorative gradient circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-gradient-to-tr from-rose-100/40 to-purple-100/40 rounded-full blur-3xl"></div>
        
        {/* Simulated map points */}
        {SIMULATED_POINTS.map(point => (
          <div 
            key={point.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: point.x, top: point.y }}
          >
            {point.pulse && (
              <span className="absolute inset-0 w-6 h-6 -m-1 bg-primary/20 rounded-full animate-ping"></span>
            )}
            <div className="w-4 h-4 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg shadow-primary/30 border-2 border-white cursor-pointer transition-transform hover:scale-150">
            </div>
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {point.label}
            </span>
          </div>
        ))}

        {/* User location marker */}
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%', top: '50%' }}
        >
          <div className="relative">
            <span className="absolute inset-0 w-8 h-8 -m-1.5 bg-blue-400/30 rounded-full animate-ping"></span>
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg shadow-blue-500/40 border-[3px] border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Connection lines (decorative) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <line x1="50%" y1="50%" x2="25%" y2="30%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50%" y1="50%" x2="60%" y2="20%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50%" y1="50%" x2="45%" y2="55%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50%" y1="50%" x2="75%" y2="45%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="4 4" />
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom label */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/60">
          <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-[11px] font-bold text-slate-500 tracking-wide">KOLKATA CRISIS NETWORK</span>
        </div>
      </div>
    );
  }

  // Google Maps implementation (when API key exists)
  // Dynamically import to avoid errors when key is missing
  return (
    <MapWithGoogle userLat={userLat} userLng={userLng} markerData={markerData} apiKey={apiKey} />
  );
}

// Separate component so the @react-google-maps import only runs when needed
function MapWithGoogle({ userLat, userLng, markerData, apiKey }) {
  const { GoogleMap, useJsApiLoader, Marker } = require('@react-google-maps/api');
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const center = { lat: userLat, lng: userLng };

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      options={{
        disableDefaultUI: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      }}
    >
      <Marker position={center} icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }} />
      {markerData && markerData.map(req => (
        <Marker
          key={req.id}
          position={{ lat: req.lat, lng: req.lng }}
          title={req.ngo_name}
          icon={{
            url: req.match_score ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png" : "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          }}
        />
      ))}
    </GoogleMap>
  ) : (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">Loading Map...</div>
  );
}
