
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver } from '../types';

interface LiveMapProps {
  drivers: Driver[];
}

const LiveMap: React.FC<LiveMapProps> = ({ drivers }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [userLocLoading, setUserLocLoading] = useState(false);

  // Function to center on user (Kuwait/Current PC Location)
  const handleLocateUser = () => {
    if (!mapRef.current) return;
    setUserLocLoading(true);
    
    // This triggers the 'locationfound' event
    mapRef.current.locate({ 
      setView: true, 
      maxZoom: 15,
      enableHighAccuracy: true 
    });
  };

  // Function to zoom out and see all drivers
  const handleFocusFleet = () => {
    if (!mapRef.current || drivers.length === 0) return;
    const activeDrivers = drivers.filter(d => d.lastKnownLocation);
    if (activeDrivers.length === 0) return;

    const bounds = L.latLngBounds(activeDrivers.map(d => [d.lastKnownLocation!.lat, d.lastKnownLocation!.lng]));
    mapRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize Leaflet Map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [20, 0], 
      zoom: 3,
      zoomControl: false,
      attributionControl: false
    });

    // Use Esri World Dark Gray Base (Professional English Labels)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(mapRef.current);

    // Add Esri Reference Layer (This ensures Labels are in English and sharp)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(mapRef.current);

    // Setup Location Success Event
    mapRef.current.on('locationfound', (e) => {
      setUserLocLoading(false);
      
      // Update or create User Marker
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(e.latlng);
      } else {
        // Professional blue dot for current user
        userMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(mapRef.current!);
        
        // Pulse effect for user
        L.circle(e.latlng, {
          radius: 100,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          className: 'animate-pulse'
        }).addTo(mapRef.current!);
      }
    });

    mapRef.current.on('locationerror', (e) => {
      setUserLocLoading(false);
      console.warn("Location access denied:", e.message);
    });

    // Auto-locate on start
    handleLocateUser();

    // Standard Zoom Control
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Driver Markers
  useEffect(() => {
    if (!mapRef.current) return;

    const activeDrivers = drivers.filter(d => d.lastKnownLocation);

    activeDrivers.forEach(driver => {
      const loc = driver.lastKnownLocation!;
      const latLng: L.LatLngExpression = [loc.lat, loc.lng];

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
      } else {
        const iconHtml = `
          <div class="relative flex flex-col items-center group">
            <div class="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
               <div class="bg-white rounded-lg p-2 shadow-xl border border-gray-100 min-w-[100px] text-center">
                  <p class="text-[10px] font-black text-gray-900 leading-none">${driver.name}</p>
                  <p class="text-[8px] font-bold text-blue-600 uppercase mt-1">${driver.vehicleNo}</p>
               </div>
            </div>
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xl border-2 border-white/20 ${
              driver.status === 'ON_JOB' 
                ? 'bg-gradient-to-br from-orange-400 to-red-600' 
                : 'bg-gradient-to-br from-sky-400 to-blue-600'
            }">
              <i class="fas ${driver.status === 'ON_JOB' ? 'fa-truck-moving' : 'fa-truck'} text-sm"></i>
            </div>
            <div class="mt-1 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[6px] font-black text-white uppercase tracking-widest border border-white/10">
              ${driver.id}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-div-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        markersRef.current[driver.id] = L.marker(latLng, { icon: customIcon }).addTo(mapRef.current!);
      }
    });

    // Cleanup old markers
    Object.keys(markersRef.current).forEach(id => {
      if (!activeDrivers.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [drivers]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Map Control Sidebar */}
      <div className="absolute top-6 left-6 z-[1000] space-y-4 pointer-events-none">
        <div className="bg-[#0f172a]/95 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl pointer-events-auto min-w-[220px]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500/50 animate-ping"></div>
            </div>
            <div>
              <h4 className="font-black text-[11px] uppercase text-white tracking-[0.2em] leading-none">Global Terminal</h4>
              <p className="text-emerald-400/70 text-[7px] font-black uppercase mt-1 tracking-widest">English Mode Active</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div>
              <p className="text-gray-500 text-[8px] font-black uppercase mb-1">Status</p>
              <p className="text-[10px] font-black text-white uppercase">Operational</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-[8px] font-black uppercase mb-1">Fleet</p>
              <p className="text-xl font-black text-white leading-none">
                {drivers.filter(d => d.lastKnownLocation).length}
              </p>
            </div>
          </div>
        </div>

        {/* Floating Action Buttons */}
        <div className="flex flex-col space-y-3 pointer-events-auto">
          {/* LOCATE ME BUTTON */}
          <button 
            onClick={handleLocateUser}
            className="bg-white hover:bg-blue-50 text-gray-900 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl border border-gray-100 transition-all active:scale-90 group"
            title="Locate Me (English Labels)"
          >
            <i className={`fas ${userLocLoading ? 'fa-circle-notch fa-spin' : 'fa-location-crosshairs'} text-xl ${userLocLoading ? 'text-blue-500' : 'text-gray-700 group-hover:text-blue-600'}`}></i>
          </button>

          {/* FOCUS FLEET BUTTON */}
          <button 
            onClick={handleFocusFleet}
            className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl border border-blue-500/50 transition-all active:scale-90 group"
            title="Focus All Drivers"
          >
            <i className="fas fa-truck-ramp-box text-xl group-hover:scale-110 transition-transform"></i>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-8 z-[1000] pointer-events-none">
         <div className="bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center space-x-6">
            <div className="flex items-center space-x-2">
               <div className="w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
               <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">On Job</span>
            </div>
            <div className="flex items-center space-x-2">
               <div className="w-3 h-3 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
               <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">Idle</span>
            </div>
            <div className="flex items-center space-x-2 border-l border-white/20 pl-6">
               <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
               <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">You (HQ)</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default LiveMap;
