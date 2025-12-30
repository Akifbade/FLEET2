
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver, Location, JobStatus, Job } from '../types';

interface LiveMapProps {
  drivers: Driver[];
  jobs: Job[];
  selectedJobId?: string | null;
  route?: Location[];
}

const LiveMap: React.FC<LiveMapProps> = ({ drivers, jobs, selectedJobId, route = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Map & Interaction States
  const [isLocked, setIsLocked] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'MISSIONS'>('DRIVERS');

  // Replay System States
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [29.3759, 47.9774], // Center of Kuwait
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    // Dark Map Layer
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

  // Handle User Location Button
  const locateUser = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 15 });
    mapRef.current.on('locationfound', (e) => {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.circleMarker(e.latlng, {
        radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8
      }).addTo(mapRef.current!);
    });
  };

  // Replay Logic
  useEffect(() => {
    if (selectedJobId && route && route.length > 0) {
      setReplayIndex(0);
      setIsReplaying(false);
      if (polylineRef.current) polylineRef.current.remove();
      
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#10b981', weight: 3, opacity: 0.6, dashArray: '5, 10'
      }).addTo(mapRef.current!);

      mapRef.current?.setView(latlngs[0], 14);
    } else {
      if (polylineRef.current) polylineRef.current.remove();
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      setReplayIndex(0);
      setIsReplaying(false);
    }
  }, [selectedJobId, route]);

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
      }, 1000 / (playbackSpeed * 2));
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, [isReplaying, route, playbackSpeed]);

  useEffect(() => {
    if (selectedJobId && route[replayIndex]) {
      const point = route[replayIndex];
      const latLng: L.LatLngExpression = [point.lat, point.lng];
      if (!replayMarkerRef.current) {
        replayMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({ 
            html: '<div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white"><i class="fas fa-truck text-xs"></i></div>',
            className: 'custom-div-icon', iconSize: [32, 32], iconAnchor: [16, 16] 
          })
        }).addTo(mapRef.current!);
      } else {
        replayMarkerRef.current.setLatLng(latLng);
      }
      if (isLocked) mapRef.current?.setView(latLng);
    }
  }, [replayIndex, selectedJobId, isLocked]);

  // Live Tracking Logic
  useEffect(() => {
    if (!mapRef.current || selectedJobId) return;

    drivers.forEach(driver => {
      if (!driver.lastKnownLocation) return;
      const latLng: L.LatLngExpression = [driver.lastKnownLocation.lat, driver.lastKnownLocation.lng];

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
      } else {
        const marker = L.marker(latLng, {
          icon: L.divIcon({
            html: `
              <div class="relative flex flex-col items-center">
                <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white border-2 border-white/20 transition-all shadow-xl ${
                  driver.status === 'ON_JOB' ? 'bg-emerald-600 animate-pulse' : 'bg-blue-600'
                }">
                  <i class="fas ${driver.status === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-sm"></i>
                </div>
                <div class="mt-1 px-2 py-0.5 bg-black/80 rounded text-[7px] font-black text-white uppercase border border-white/10">
                  ${driver.vehicleNo}
                </div>
              </div>
            `,
            className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20]
          })
        }).addTo(mapRef.current!);
        
        marker.on('click', () => {
          focusOnDriver(driver);
        });
        
        markersRef.current[driver.id] = marker;
      }

      if (isLocked && lockedTargetId === driver.id) {
        mapRef.current?.setView(latLng);
      }
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!drivers.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [drivers, selectedJobId, isLocked, lockedTargetId]);

  const focusOnDriver = (driver: Driver) => {
    if (!driver.lastKnownLocation || !mapRef.current) return;
    setIsLocked(true);
    setLockedTargetId(driver.id);
    mapRef.current.setView([driver.lastKnownLocation.lat, driver.lastKnownLocation.lng], 16, { animate: true });
  };

  const activeMissions = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* TOOLBAR */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col space-y-3">
        <button onClick={() => setShowSidebar(!showSidebar)} className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 hover:bg-blue-600 transition">
          <i className={`fas ${showSidebar ? 'fa-indent' : 'fa-outdent'}`}></i>
        </button>
        <button onClick={locateUser} className="w-12 h-12 bg-white text-slate-900 rounded-2xl flex items-center justify-center shadow-2xl border border-gray-100 hover:bg-blue-50 transition">
          <i className="fas fa-location-crosshairs text-lg"></i>
        </button>
        <button onClick={() => { setIsLocked(false); setLockedTargetId(null); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl border transition ${isLocked ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-900/50 text-gray-400 border-white/10'}`}>
          <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
        </button>
      </div>

      {/* SIDEBAR */}
      {showSidebar && !selectedJobId && (
        <div className="absolute right-6 top-6 bottom-6 z-[1000] w-80 bg-slate-950/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-12">
          <div className="p-6 border-b border-white/5 flex space-x-2">
            <button onClick={() => setActiveTab('DRIVERS')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'DRIVERS' ? 'bg-white text-slate-950 shadow-lg' : 'text-gray-500 hover:text-white'}`}>Units</button>
            <button onClick={() => setActiveTab('MISSIONS')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'MISSIONS' ? 'bg-white text-slate-950 shadow-lg' : 'text-gray-500 hover:text-white'}`}>Missions</button>
          </div>

          <div className="flex-grow overflow-y-auto scrollbar-hide p-4 space-y-3">
            {activeTab === 'DRIVERS' ? (
              drivers.map(d => (
                <button key={d.id} onClick={() => focusOnDriver(d)} className={`w-full text-left p-4 rounded-3xl border transition-all ${lockedTargetId === d.id ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-black text-sm">{d.name}</span>
                    <span className={`w-2 h-2 rounded-full ${d.status === 'ON_JOB' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{d.vehicleNo}</span>
                    <span className="text-[10px] font-black text-white">{Math.round(d.lastKnownLocation?.speed || 0)} KM/H</span>
                  </div>
                </button>
              ))
            ) : (
              activeMissions.length === 0 ? (
                <div className="text-center py-20 text-gray-600">
                  <i className="fas fa-truck-fast text-4xl mb-4 opacity-20"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">No Active Missions</p>
                </div>
              ) : (
                activeMissions.map(m => (
                  <button key={m.id} onClick={() => focusOnDriver(drivers.find(d => d.id === m.driverId)!)} className="w-full text-left p-5 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 transition">
                    <div className="flex justify-between mb-3">
                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em]">{m.tripType}</span>
                       <span className="text-[8px] font-black text-white uppercase opacity-50">ID: {m.id}</span>
                    </div>
                    <p className="text-white font-black text-sm mb-1">{m.origin} → {m.destination}</p>
                    <p className="text-[9px] font-black text-emerald-500/80 uppercase">Assignee: {drivers.find(d => d.id === m.driverId)?.name}</p>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* REPLAY COCKPIT HUD */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-3xl px-6">
          <div className="bg-slate-950/90 backdrop-blur-3xl rounded-[3.5rem] p-10 border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h4 className="text-white text-2xl font-black tracking-tighter uppercase">Route Dossier Analysis</h4>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{route.length} GPS Checkpoints Logged</p>
              </div>
              <div className="flex space-x-3">
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition ${playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}>{s}X</button>
                ))}
              </div>
            </div>

            <div className="relative h-2 bg-white/5 rounded-full mb-10 cursor-pointer group" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setReplayIndex(Math.floor(((e.clientX - rect.left) / rect.width) * (route.length - 1)));
            }}>
              <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981]" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
              <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition" style={{ left: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
            </div>

            <div className="flex justify-center items-center space-x-12">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white transition border border-white/5 text-xl"><i className="fas fa-backward-step"></i></button>
              <button onClick={() => setIsReplaying(!isReplaying)} className="w-24 h-24 rounded-[3rem] bg-white text-slate-950 text-4xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition">
                <i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
              <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white transition border border-white/5 text-xl"><i className="fas fa-forward-step"></i></button>
            </div>

            <div className="mt-10 flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest border-t border-white/5 pt-6">
              <div className="flex items-center space-x-3">
                 <i className="fas fa-clock"></i>
                 <span>{new Date(route[replayIndex].timestamp || 0).toLocaleTimeString()}</span>
              </div>
              <div className="text-emerald-500">Live Telemetry Synchronized</div>
              <div className="flex items-center space-x-3">
                 <span>{Math.round(route[replayIndex].speed || 0)} KM/H</span>
                 <i className="fas fa-gauge-high"></i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
