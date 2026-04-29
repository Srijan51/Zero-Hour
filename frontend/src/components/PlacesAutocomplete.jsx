import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

/**
 * Location autocomplete using Photon geocoder (powered by OpenStreetMap).
 * Photon is purpose-built for autocomplete — much more accurate than raw Nominatim.
 * Biases results toward user's current location for relevance.
 *
 * Props:
 *   value       – current location text
 *   onChange    – (locationText, lat, lng) => void
 *   placeholder – input placeholder
 *   className   – extra classes for the outer wrapper
 */

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return '';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km away`;
  return `${Math.round(distanceKm)} km away`;
}

export default function PlacesAutocomplete({ value, onChange, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const [geocoderError, setGeocoderError] = useState('');
  const [biasLocation, setBiasLocation] = useState({ lat: 22.5726, lon: 88.3639 }); // Default Kolkata
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Get user's location for bias
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setBiasLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // Keep default
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

  const sortSuggestionsByDistance = (features) => {
    return [...features]
      .map((feature, index) => {
        const [lng, lat] = feature.geometry?.coordinates || [];
        const distanceKm = getDistanceKm(biasLocation.lat, biasLocation.lon, Number(lat), Number(lng));
        return {
          ...feature,
          properties: {
            ...(feature.properties || {}),
            distance_km: distanceKm,
            original_index: index,
          },
        };
      })
      .sort((a, b) => {
        const aDistance = a.properties?.distance_km;
        const bDistance = b.properties?.distance_km;
        if (Number.isFinite(aDistance) && Number.isFinite(bDistance)) {
          return aDistance - bDistance;
        }
        if (Number.isFinite(aDistance)) return -1;
        if (Number.isFinite(bDistance)) return 1;
        return (a.properties?.original_index || 0) - (b.properties?.original_index || 0);
      });
  };

  // Keep input in sync with parent value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (input) => {
    const query = input.trim();
    if (!query || query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowDropdown(false);
      setHasSearched(false);
      setGeocoderError('');
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setShowDropdown(true);
    setHasSearched(false);
    setGeocoderError('');
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '7',
        lat: String(biasLocation.lat),
        lon: String(biasLocation.lon),
        lang: 'en',
      });

      const resp = await fetch(`${PHOTON_URL}?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!resp.ok) throw new Error('Photon request failed');
      const data = await resp.json();

      const features = sortSuggestionsByDistance(data.features || []);

      if (requestId !== requestIdRef.current) return;
      setSuggestions(features);
      setShowDropdown(true);
      setHasSearched(true);
      setActiveIndex(-1);
      setGeocoderError(features.length > 0 ? '' : 'No matching locations found');
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          const features = sortSuggestionsByDistance(await fetchNominatimSuggestions(query, abortControllerRef.current.signal));
          if (requestId !== requestIdRef.current) return;
          setSuggestions(features);
          setShowDropdown(true);
          setHasSearched(true);
          setActiveIndex(-1);
          setGeocoderError(features.length > 0 ? '' : 'No matching locations found');
        } catch (fallbackErr) {
          if (fallbackErr.name !== 'AbortError') {
            console.error('Location geocoder error:', fallbackErr);
            if (requestId !== requestIdRef.current) return;
            setSuggestions([]);
            setShowDropdown(true);
            setHasSearched(true);
            setGeocoderError('Location suggestions are unavailable right now');
          }
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const fetchNominatimSuggestions = async (query, signal) => {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '7',
      'accept-language': 'en',
    });

    const resp = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { signal });
    if (!resp.ok) throw new Error('Nominatim request failed');
    const data = await resp.json();

    return (Array.isArray(data) ? data : []).map((place, idx) => {
      const address = place.address || {};
      const displayParts = (place.display_name || '').split(',').map((part) => part.trim()).filter(Boolean);
      return {
        geometry: {
          coordinates: [Number(place.lon), Number(place.lat)],
        },
        properties: {
          osm_id: place.osm_id || `nominatim-${idx}`,
          osm_key: place.class || 'place',
          osm_value: place.type || '',
          name: address.name || place.name || displayParts[0],
          street: address.road || address.pedestrian || address.neighbourhood,
          district: address.suburb || address.city_district || address.county,
          city: address.city || address.town || address.village || address.municipality,
          state: address.state,
          country: address.country,
        },
      };
    });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val, null, null);
    setGeocoderError('');
    setHasSearched(false);
    setShowDropdown(val.trim().length >= MIN_QUERY_LENGTH);

    // Debounce
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  };

  // Build a human-readable display name from Photon's properties
  const buildDisplayName = (props) => {
    const parts = [];
    if (props.name) parts.push(props.name);
    if (props.street) {
      let street = props.street;
      if (props.housenumber) street = `${props.housenumber} ${street}`;
      if (!parts.includes(street)) parts.push(street);
    }
    if (props.district && !parts.includes(props.district)) parts.push(props.district);
    if (props.city && !parts.includes(props.city)) parts.push(props.city);
    if (props.state && !parts.includes(props.state)) parts.push(props.state);
    if (props.country && !parts.includes(props.country)) parts.push(props.country);
    return parts.join(', ') || 'Unknown location';
  };

  const handleSelectSuggestion = (feature) => {
    const props = feature.properties || {};
    const [lng, lat] = feature.geometry?.coordinates || [null, null];
    const displayName = buildDisplayName(props);

    setInputValue(displayName);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    onChange(displayName, lat, lng);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
    setHasSearched(false);
    setGeocoderError('');
    onChange('', null, null);
  };

  // Format a suggestion into primary + secondary display text
  const formatSuggestion = (feature) => {
    const props = feature.properties || {};
    const primary = props.name || props.street || props.city || 'Unknown';

    const secondaryParts = [];
    if (props.street && props.name && props.street !== props.name) secondaryParts.push(props.street);
    if (props.district) secondaryParts.push(props.district);
    if (props.city && props.city !== primary) secondaryParts.push(props.city);
    if (props.state) secondaryParts.push(props.state);
    if (props.country) secondaryParts.push(props.country);
    const distance = formatDistance(props.distance_km);
    if (distance) secondaryParts.unshift(distance);
    const secondary = secondaryParts.join(' - ');

    return { primary, secondary };
  };

  // Type icon based on OSM type
  const getTypeEmoji = (feature) => {
    const type = feature.properties?.osm_value || '';
    const key = feature.properties?.osm_key || '';
    if (key === 'amenity') return '🏢';
    if (key === 'highway' || type === 'road' || type === 'residential') return '🛣️';
    if (type === 'city' || type === 'town' || type === 'village') return '🏙️';
    if (type === 'state' || type === 'country') return '🌍';
    if (key === 'railway' || key === 'aeroway') return '🚉';
    if (key === 'leisure' || key === 'tourism') return '🏖️';
    if (key === 'shop') return '🏪';
    if (key === 'building' || type === 'house' || type === 'apartments') return '🏠';
    return null;
  };

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none z-10" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => { if (inputValue.trim().length >= MIN_QUERY_LENGTH) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search for a location..."}
          className="w-full mt-1 pl-9 pr-9 py-3 bg-white rounded-xl text-sm border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 animate-spin" />
        )}
        {!isLoading && inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (isLoading || geocoderError || suggestions.length > 0 || hasSearched) && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] border border-slate-100 overflow-hidden max-h-[320px] overflow-y-auto custom-scrollbar">
          {isLoading && suggestions.length === 0 && (
            <div className="px-4 py-3 flex items-center space-x-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
              <span className="text-sm font-medium">Searching locations...</span>
            </div>
          )}

          {!isLoading && geocoderError && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm font-medium text-slate-500">
              {geocoderError}
            </div>
          )}

          {!isLoading && !geocoderError && hasSearched && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm font-medium text-slate-500">
              No matching locations found
            </div>
          )}

          {suggestions.map((feature, idx) => {
            const { primary, secondary } = formatSuggestion(feature);
            const isActive = idx === activeIndex;

            return (
              <button
                key={`${feature.properties?.osm_id || idx}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(feature)}
                className={`w-full text-left px-4 py-3.5 transition-colors flex items-center space-x-3 group border-b border-slate-100 last:border-b-0 ${
                  isActive ? 'bg-primary/5' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isActive ? 'bg-primary/10' : 'bg-slate-100 group-hover:bg-primary/10'
                }`}>
                  <MapPin className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-primary' : 'text-slate-500 group-hover:text-primary'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug truncate">
                    <span className="text-slate-800 font-semibold">{primary}</span>
                  </p>
                  {secondary && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {secondary}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
