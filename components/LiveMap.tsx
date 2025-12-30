
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver, Location } from '../types';

interface LiveMapProps {
  drivers: Driver[];
  selectedJobId?: string | null;
  route?: Location[];
}

const LiveMap: React.FC<LiveMapProps> = ({ drivers, selectedJobId, route = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // States for Map UI
  const [isLocked, setIsLocked] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  // States for Replay System
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const playbackIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [29.3759, 47.9774],
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    // High Contrast Dark Map Layers
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png', {
      maxZoom: 19
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Playback Logic
  useEffect(() => {
    if (selectedJobId && route && route.length > 0) {
      // Initialize Replay UI
      setReplayIndex(0);
      setIsReplaying(false);
      
      // Draw Path
      if (polylineRef.current) polylineRef.current.remove();
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#10b981',
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 10',
        lineJoin: 'round'
      }).addTo(mapRef.current!);

      // Focus on the start of the route
      mapRef.current?.setView(latlngs[0], 14);
    } else {
      if (polylineRef.current) polylineRef.current.remove();
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      setReplayIndex(0);
      setIsReplaying(false);
    }
  }, [selectedJobId, route]);

  // Replay Animation Loop
  useEffect(() => {
    if (isReplaying && route.length > 0) {
      playbackIntervalRef.current = window.setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= route.length - 1) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / (playbackSpeed * 2)); // Dynamic speed base
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, [isReplaying, route, playbackSpeed]);

  // Update Replay Marker Position
  useEffect(() => {
    if (selectedJobId && route[replayIndex]) {
      const point = route[replayIndex];
      const latLng: L.LatLngExpression = [point.lat, point.lng];

      if (!replayMarkerRef.current) {
        const iconHtml = `
          <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,1)]">
              <i class="fas fa-truck text-xs text-white"></i>
            </div>
          </div>
        `;
        replayMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({ html: iconHtml, className: 'custom-div-icon', iconSize: [32, 32], iconAnchor: [16, 16] })
        }).addTo(mapRef.current!);
      } else {
        replayMarkerRef.current.setLatLng(latLng);
      }

      if (isLocked) {
        mapRef.current?.setView(latLng);
      }
    } else {
      if (replayMarkerRef.current) {
        replayMarkerRef.current.remove();
        replayMarkerRef.current = null;
      }
    }
  }, [replayIndex, selectedJobId, isLocked]);

  // Handle Driver Markers & Lock Mode
  useEffect(() => {
    if (!mapRef.current || selectedJobId) return;

    drivers.forEach(driver => {
      if (!driver.lastKnownLocation) return;
      const latLng: L.LatLngExpression = [driver.lastKnownLocation.lat, driver.lastKnownLocation.lng];

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
      } else {
        const iconHtml = `
          <div class="relative flex flex-col items-center group cursor-pointer">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white border-2 border-white/20 transition-all duration-300 shadow-xl ${
              driver.status === 'ON_JOB' ? 'bg-emerald-600 shadow-emerald-500/50 scale-110' : 'bg-blue-600 shadow-blue-500/30'
            }">
              <i class="fas ${driver.status === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-sm"></i>
            </div>
            <div class="mt-2 px-2 py-0.5 bg-black/80 rounded text-[7px] font-black text-white uppercase border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              ${driver.name}
            </div>
          </div>
        `;

        const marker = L.marker(latLng, {
          icon: L.divIcon({ html: iconHtml, className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20] })
        }).addTo(mapRef.current!);

        marker.on('click', () => {
          setSelectedDriverId(driver.id);
          setIsLocked(true);
          mapRef.current?.setView(latLng, 16);
        });

        markersRef.current[driver.id] = marker;
      }

      // Auto-Follow if locked on this driver
      if (isLocked && selectedDriverId === driver.id) {
        mapRef.current?.setView(latLng);
      }
    });

    // Cleanup markers for removed drivers
    Object.keys(markersRef.current).forEach(id => {
      if (!drivers.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [drivers, selectedJobId, isLocked, selectedDriverId]);

  return (
    <div className="w-full h-full relative overflow-hidden group">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* TOP CONTROLS: VIEW MODES */}
      <div className="absolute top-6 left-6 z-[1000] space-y-3">
        <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl min-w-[180px]">
           <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-2">Map Terminal</p>
           <div className="flex flex-col space-y-2">
              <button 
                onClick={() => { setIsLocked(!isLocked); if (!isLocked && !selectedDriverId && !selectedJobId) setIsLocked(false); }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isLocked ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{isLocked ? 'Tracking Active' : 'Free Camera'}</span>
                <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-[10px]`}></i>
              </button>
           </div>
        </div>
      </div>

      {/* REPLAY HUD: ONLY SHOWN DURING REPLAY */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-6">
           <div className="bg-slate-950/90 backdrop-blur-2xl rounded-[3rem] p-8 border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-12">
              <div className="flex justify-between items-center mb-8">
                 <div>
                    <h4 className="text-white text-lg font-black tracking-tight uppercase">Mission Replay Module</h4>
                    <p className="text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">{route.length} GPS Points Recorded</p>
                 </div>
                 <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => setPlaybackSpeed(s => s === 4 ? 1 : s * 2)}
                      className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black border border-white/5 transition"
                    >
                      {playbackSpeed}x SPEED
                    </button>
                 </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-1.5 bg-white/5 rounded-full mb-8 cursor-pointer group/progress" 
                   onClick={(e) => {
                     const rect = e.currentTarget.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     const percentage = x / rect.width;
                     setReplayIndex(Math.floor(percentage * (route.length - 1)));
                   }}>
                 <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981]" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
                 <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white rounded-full shadow-xl opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
              </div>

              {/* Controls */}
              <div className="flex justify-center items-center space-x-8">
                 <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 5))} className="w-12 h-12 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition border border-white/5">
                    <i className="fas fa-backward-step"></i>
                 </button>
                 <button 
                  onClick={() => setIsReplaying(!isReplaying)}
                  className="w-20 h-20 rounded-full bg-white text-slate-950 text-2xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition"
                 >
                    <i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i>
                 </button>
                 <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 5))} className="w-12 h-12 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition border border-white/5">
                    <i className="fas fa-forward-step"></i>
                 </button>
              </div>

              <div className="mt-8 flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                 <span>{new Date(route[0].timestamp || 0).toLocaleTimeString()}</span>
                 <span className="text-white">{Math.round((replayIndex / (route.length - 1)) * 100)}% COMPLETE</span>
                 <span>{new Date(route[route.length-1].timestamp || 0).toLocaleTimeString()}</span>
              </div>
           </div>
        </div>
      )}

      {/* SIDEBAR UI FOR LIVE VIEW */}
      {!selectedJobId && (
        <div className="absolute right-6 top-6 z-[1000] w-80 space-y-4">
           {selectedDriverId && (
             <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl animate-in slide-in-from-right-8">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h4 className="text-white text-xl font-black uppercase tracking-tighter">{drivers.find(d => d.id === selectedDriverId)?.name}</h4>
                      <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">{drivers.find(d => d.id === selectedDriverId)?.vehicleNo}</p>
                   </div>
                   <button onClick={() => { setSelectedDriverId(null); setIsLocked(false); }} className="text-gray-500 hover:text-white transition">
                      <i className="fas fa-times-circle text-2xl"></i>
                   </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Live Speed</p>
                      <p className="text-2xl font-black text-white">{Math.round(drivers.find(d => d.id === selectedDriverId)?.lastKnownLocation?.speed || 0)} <span className="text-[10px] text-gray-600">KM/H</span></p>
                   </div>
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Status</p>
                      <p className={`text-sm font-black uppercase ${drivers.find(d => d.id === selectedDriverId)?.status === 'ON_JOB' ? 'text-emerald-500' : 'text-blue-500'}`}>
                        {drivers.find(d => d.id === selectedDriverId)?.status}
                      </p>
                   </div>
                </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default LiveMap;
