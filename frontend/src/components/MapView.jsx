import React from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

export default function MapView({ userLat, userLng, markerData }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const center = {
    lat: userLat,
    lng: userLng
  };

  if (loadError) {
    return (
      <div className="w-full h-full bg-slate-300 flex items-center justify-center p-6 text-center">
        <p className="text-slate-600">Map cannot be loaded in Mock Mode without API key, but the app matches still work!</p>
      </div>
    );
  }

  return isLoaded ? (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
        options={{
          disableDefaultUI: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* User Location */}
        <Marker 
          position={center} 
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
          }}
        />

        {/* NGO Requests */}
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
  ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">Loading Map...</div>;
}
