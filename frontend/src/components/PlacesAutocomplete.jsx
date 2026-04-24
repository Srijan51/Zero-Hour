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

export default function PlacesAutocomplete({ value, onChange, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [biasLocation, setBiasLocation] = useState({ lat: 22.5726, lon: 88.3639 }); // Default Kolkata
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);

  // Get user's location for bias
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setBiasLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // Keep default
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  }, []);

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
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: input,
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

      const features = data.features || [];
      setSuggestions(features);
      setShowDropdown(features.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Photon geocoder error:', err);
        setSuggestions([]);
        setShowDropdown(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val, null, null);

    // Debounce
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
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
    const secondary = secondaryParts.join(', ');

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
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search for a location..."}
          className="w-full mt-1 pl-9 pr-9 py-3 bg-slate-50 rounded-xl text-sm border border-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-[280px] overflow-y-auto custom-scrollbar">
          {suggestions.map((feature, idx) => {
            const { primary, secondary } = formatSuggestion(feature);
            const typeEmoji = getTypeEmoji(feature);
            const isActive = idx === activeIndex;

            return (
              <button
                key={`${feature.properties?.osm_id || idx}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(feature)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start space-x-3 group border-b border-slate-50 last:border-b-0 ${
                  isActive ? 'bg-primary/5' : 'hover:bg-primary/5'
                }`}
              >
                <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-300 group-hover:text-primary'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug truncate">
                    <span className="text-slate-800 font-semibold">{primary}</span>
                    {typeEmoji && <span className="ml-1.5 text-xs">{typeEmoji}</span>}
                  </p>
                  {secondary && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {secondary}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          <div className="px-4 py-1.5 bg-slate-50/50 flex items-center justify-end">
            <span className="text-[9px] text-slate-300 font-medium tracking-wide">
              © OpenStreetMap contributors
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
