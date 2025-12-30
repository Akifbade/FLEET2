
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver, Location, JobStatus, Job } from '../types';
import { getEffectiveStatus } from './AdminDashboard';

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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Standard high-detail OSM layer for better street visibility
    mapRef.current = L.map(mapContainerRef.current, {
      center: [29.3759, 47.9774], // Default center (Kuwait)
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 19
    });

    // Using OpenStreetMap standard tiles (much more detail than Voyager)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Initial Zoom to all active drivers
    const driversWithLoc = drivers.filter(d => d.lastKnownLocation);
    if (driversWithLoc.length > 0) {
      const markers = driversWithLoc.map(d => L.marker([d.lastKnownLocation!.lat, d.lastKnownLocation!.lng]));
      const group = L.featureGroup(markers);
      mapRef.current.fitBounds(group.getBounds().pad(0.3), { maxZoom: 15 });
    }

    // Leaflet resize fix
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 500);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Locate logic with high zoom
  const locateUser = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 17 });
    mapRef.current.once('locationfound', (e) => {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.circleMarker(e.latlng, {
        radius: 12, fillColor: '#2563eb', color: '#fff', weight: 4, opacity: 1, fillOpacity: 1
      }).addTo(mapRef.current!);
      mapRef.current?.setView(e.latlng, 17, { animate: true });
    });
  };

  // Replay Path Logic
  useEffect(() => {
    if (selectedJobId && route && route.length > 0) {
      setReplayIndex(0);
      setIsReplaying(false);
      setShowSidebar(false);
      if (polylineRef.current) polylineRef.current.remove();
      
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#10b981', weight: 6, opacity: 1, lineJoin: 'round', lineCap: 'round'
      }).addTo(mapRef.current!);

      mapRef.current?.fitBounds(polylineRef.current.getBounds(), { padding: [100, 100], maxZoom: 16 });
    } else {
      if (polylineRef.current) polylineRef.current.remove();
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      setReplayIndex(0);
      setIsReplaying(false);
    }
  }, [selectedJobId, route]);

  // Replay playback
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
      }, 1000 / (playbackSpeed * 3));
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, [isReplaying, route, playbackSpeed]);

  // Replay marker update
  useEffect(() => {
    if (selectedJobId && route[replayIndex]) {
      const point = route[replayIndex];
      const latLng: L.LatLngExpression = [point.lat, point.lng];
      if (!replayMarkerRef.current) {
        replayMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({ 
            html: `
              <div class="relative flex flex-col items-center">
                <div class="w-14 h-14 rounded-full bg-emerald-600 border-4 border-white shadow-2xl flex items-center justify-center text-white scale-110">
                  <i class="fas fa-truck text-lg"></i>
                </div>
              </div>
            `,
            className: 'custom-div-icon', iconSize: [56, 56], iconAnchor: [28, 28] 
          })
        }).addTo(mapRef.current!);
      } else {
        replayMarkerRef.current.setLatLng(latLng);
      }
      if (isLocked) mapRef.current?.setView(latLng, 17, { animate: true });
    }
  }, [replayIndex, selectedJobId, isLocked]);

  // Real-time Driver Tracking
  useEffect(() => {
    if (!mapRef.current || selectedJobId) return;

    drivers.forEach(driver => {
      if (!driver.lastKnownLocation) return;
      const latLng: L.LatLngExpression = [driver.lastKnownLocation.lat, driver.lastKnownLocation.lng];
      const effectiveStatus = getEffectiveStatus(driver);

      const iconHtml = `
        <div class="relative flex flex-col items-center group">
          <div class="w-14 h-14 rounded-[1.75rem] flex items-center justify-center text-white border-4 border-white transition-all shadow-2xl ${
            effectiveStatus === 'ON_JOB' ? 'bg-emerald-600 animate-pulse' : 
            effectiveStatus === 'ONLINE' ? 'bg-blue-600' : 'bg-slate-500'
          }">
            <i class="fas ${effectiveStatus === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-xl"></i>
          </div>
          <div class="mt-2 px-3 py-1 bg-slate-900 rounded-lg text-[10px] font-black text-white uppercase border border-white/20 shadow-2xl whitespace-nowrap">
            ${driver.vehicleNo}
          </div>
        </div>
      `;

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
        markersRef.current[driver.id].setIcon(L.divIcon({
          html: iconHtml, className: 'custom-div-icon', iconSize: [56, 56], iconAnchor: [28, 56]
        }));
      } else {
        const marker = L.marker(latLng, {
          icon: L.divIcon({
            html: iconHtml, className: 'custom-div-icon', iconSize: [56, 56], iconAnchor: [28, 56]
          })
        }).addTo(mapRef.current!);
        
        marker.on('click', () => {
          focusOnDriver(driver);
        });
        
        markersRef.current[driver.id] = marker;
      }

      if (isLocked && lockedTargetId === driver.id) {
        mapRef.current?.setView(latLng, 17, { animate: true });
      }
    });
  }, [drivers, selectedJobId, isLocked, lockedTargetId]);

  const focusOnDriver = (driver: Driver) => {
    if (!driver.lastKnownLocation || !mapRef.current) return;
    setIsLocked(true);
    setLockedTargetId(driver.id);
    mapRef.current.setView([driver.lastKnownLocation.lat, driver.lastKnownLocation.lng], 17, { animate: true });
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const activeMissions = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Toolbar */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col space-y-4">
        <button onClick={() => setShowSidebar(!showSidebar)} className="w-14 h-14 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl border border-white/10 hover:bg-blue-600 transition active:scale-95">
          <i className={`fas ${showSidebar ? 'fa-indent' : 'fa-list-ul'}`}></i>
        </button>
        <button onClick={locateUser} className="w-14 h-14 bg-white text-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl border border-gray-100 hover:bg-gray-50 transition active:scale-95">
          <i className="fas fa-location-crosshairs text-xl"></i>
        </button>
        <button onClick={() => { setIsLocked(false); setLockedTargetId(null); }} className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl border transition active:scale-95 ${isLocked ? 'bg-blue-600 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}>
          <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
        </button>
      </div>

      {/* Sidebar Panel */}
      {showSidebar && !selectedJobId && (
        <div className="absolute top-6 bottom-6 right-6 z-[1001] w-full md:w-[360px] flex flex-col animate-in slide-in-from-right-10">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[3rem] border border-gray-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] flex flex-col h-full overflow-hidden">
            <div className="p-5 flex bg-gray-50/50 border-b border-gray-100">
              <button onClick={() => setActiveTab('DRIVERS')} className={`flex-1 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'DRIVERS' ? 'bg-slate-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>Units</button>
              <button onClick={() => setActiveTab('MISSIONS')} className={`flex-1 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'MISSIONS' ? 'bg-slate-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>Missions</button>
            </div>

            <div className="flex-grow overflow-y-auto scrollbar-hide p-6 space-y-4">
              {activeTab === 'DRIVERS' ? (
                drivers.map(d => {
                  const effectiveStatus = getEffectiveStatus(d);
                  return (
                    <button 
                      key={d.id} 
                      onClick={() => focusOnDriver(d)} 
                      className={`w-full text-left p-6 rounded-[2.5rem] border-2 transition-all ${lockedTargetId === d.id ? 'bg-white border-blue-500 shadow-xl' : 'bg-white border-gray-50 shadow-sm hover:border-blue-200'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-black text-slate-900 text-base uppercase tracking-tight">{d.name}</span>
                        <div className={`w-3 h-3 rounded-full ${effectiveStatus === 'ON_JOB' ? 'bg-emerald-500 animate-pulse' : effectiveStatus === 'ONLINE' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">{d.vehicleNo}</span>
                        <span className="text-[12px] font-black text-slate-900">{Math.round(d.lastKnownLocation?.speed || 0)} KM/H</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                activeMissions.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <i className="fas fa-truck-fast text-4xl mb-4 opacity-10"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">No active tasks</p>
                  </div>
                ) : (
                  activeMissions.map(m => (
                    <button key={m.id} onClick={() => {
                      const d = drivers.find(d => d.id === m.driverId);
                      if (d) focusOnDriver(d);
                    }} className="w-full text-left p-6 rounded-[2.5rem] bg-emerald-50 border-2 border-emerald-100 shadow-sm hover:border-emerald-300 transition-all">
                      <div className="flex justify-between mb-4">
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.3em]">{m.tripType}</span>
                        <span className="text-[9px] font-black text-gray-300"># {m.id}</span>
                      </div>
                      <p className="text-slate-900 font-black text-base leading-tight mb-2">{m.origin} → {m.destination}</p>
                      <p className="text-[10px] font-black text-emerald-600/80 uppercase">Unit: {drivers.find(d => d.id === m.driverId)?.name}</p>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replay Dossier Controls */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1100] w-full max-w-2xl px-6 animate-in slide-in-from-bottom-20">
          <div className="bg-slate-900/95 backdrop-blur-3xl rounded-[4rem] p-10 border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h4 className="text-white text-2xl font-black tracking-tighter uppercase">Dossier Analysis</h4>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{route.length} GPS Checkpoints</p>
              </div>
              <div className="flex space-x-2">
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition ${playbackSpeed === s ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{s}X</button>
                ))}
              </div>
            </div>

            <div className="relative h-2 bg-white/10 rounded-full mb-10 cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setReplayIndex(Math.floor(((e.clientX - rect.left) / rect.width) * (route.length - 1)));
            }}>
              <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981] transition-all duration-300" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
            </div>

            <div className="flex justify-center items-center space-x-12">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white border border-white/5 transition text-xl active:scale-90"><i className="fas fa-backward-step"></i></button>
              <button onClick={() => setIsReplaying(!isReplaying)} className="w-24 h-24 rounded-[2.5rem] bg-white text-slate-950 text-4xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition">
                <i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
              <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white border border-white/5 transition text-xl active:scale-90"><i className="fas fa-forward-step"></i></button>
            </div>

            <div className="mt-10 flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest border-t border-white/5 pt-8">
              <div className="flex items-center space-x-3">
                 <i className="fas fa-clock text-blue-500"></i>
                 <span>{new Date(route[replayIndex].timestamp || 0).toLocaleTimeString()}</span>
              </div>
              <div className="text-emerald-500 font-black tracking-[0.2em] animate-pulse">Telemetry Sync v2.5</div>
              <div className="flex items-center space-x-3">
                 <span className="text-white">{Math.round(route[replayIndex].speed || 0)} KM/H</span>
                 <i className="fas fa-gauge-high text-blue-500"></i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
