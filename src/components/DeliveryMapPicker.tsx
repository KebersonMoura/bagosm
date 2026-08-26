import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Info, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import {
  getDeliverySettings,
  calculateHaversineDistance,
  calculateDeliveryFee,
  StoreDeliverySettings,
  FeeCalculationResult
} from '../utils/deliverySettings';

interface DeliveryMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  subtotal?: number;
  onLocationSelect?: (data: {
    lat: number;
    lng: number;
    address?: string;
    distanceKm: number;
    fee: number;
    tierLabel: string;
    isOutOfRange: boolean;
    street?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    isGpsLocate?: boolean;
  }) => void;
  isStorePicker?: boolean;
  height?: string;
  triggerGpsSignal?: number;
  onGpsStateChange?: (loading: boolean, error: string | null) => void;
  hideTopGpsButton?: boolean;
  isVisible?: boolean;
}

export const DeliveryMapPicker: React.FC<DeliveryMapPickerProps> = ({
  initialLat,
  initialLng,
  initialAddress = '',
  subtotal = 0,
  onLocationSelect,
  isStorePicker = false,
  height = '320px',
  triggerGpsSignal = 0,
  onGpsStateChange,
  hideTopGpsButton = false,
  isVisible = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [settings, setSettings] = useState<StoreDeliverySettings>(() => getDeliverySettings());
  const [selectedLat, setSelectedLat] = useState<number>(initialLat || settings.storeLat);
  const [selectedLng, setSelectedLng] = useState<number>(initialLng || settings.storeLng);
  const [addressInput, setAddressInput] = useState<string>(initialAddress);
  const [geocoding, setGeocoding] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showIosPromptModal, setShowIosPromptModal] = useState(false);
  const [isIosBlocked, setIsIosBlocked] = useState(false);

  // iPhone / iOS Detection
  const isIosDevice = typeof window !== 'undefined' && typeof navigator !== 'undefined' && (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  // Distance and Fee calculations
  const distanceKm = calculateHaversineDistance(
    settings.storeLat,
    settings.storeLng,
    selectedLat,
    selectedLng
  );

  const feeResult: FeeCalculationResult = calculateDeliveryFee(distanceKm, subtotal, settings);

  // Listen to updated settings
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(getDeliverySettings());
    };
    window.addEventListener('deliverySettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('deliverySettingsUpdated', handleSettingsUpdate);
  }, []);

  // Notify parent on GPS state changes
  useEffect(() => {
    onGpsStateChange?.(geocoding, geoError);
  }, [geocoding, geoError, onGpsStateChange]);

  // Handle external GPS trigger signal
  const lastSignalRef = useRef<number>(0);
  useEffect(() => {
    if (triggerGpsSignal && triggerGpsSignal > lastSignalRef.current) {
      lastSignalRef.current = triggerGpsSignal;
      handleUseCurrentLocation();
    }
  }, [triggerGpsSignal]);

  // Update parent callback when location changes
  useEffect(() => {
    if (onLocationSelect) {
      onLocationSelect({
        lat: selectedLat,
        lng: selectedLng,
        address: addressInput,
        distanceKm,
        fee: feeResult.fee,
        tierLabel: feeResult.tierLabel,
        isOutOfRange: feeResult.isOutOfRange
      });
    }
  }, [selectedLat, selectedLng, addressInput, distanceKm, feeResult.fee, feeResult.tierLabel, feeResult.isOutOfRange]);

  // Create custom icons using L.divIcon
  const createStoreIcon = () =>
    L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="
          background: #ab1a15;
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        ">
          🏬
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

  const createDeliveryIcon = () =>
    L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div style="
          background: #f09534;
          color: #1A1C23;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: grab;
        ">
          🛵
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialCenter: [number, number] = [selectedLat, selectedLng];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add Store Marker
    const storePos: [number, number] = [settings.storeLat, settings.storeLng];
    const storeMarker = L.marker(storePos, { icon: createStoreIcon() })
      .addTo(map)
      .bindPopup(`<b>🏬 Loja / Ponto de Origem</b><br/>${settings.storeAddress}`);
    storeMarkerRef.current = storeMarker;

    // Add Delivery Marker (Draggable)
    if (!isStorePicker) {
      const deliveryPos: [number, number] = [selectedLat, selectedLng];
      const deliveryMarker = L.marker(deliveryPos, {
        icon: createDeliveryIcon(),
        draggable: true
      }).addTo(map);

      deliveryMarker.on('dragend', (e) => {
        const marker = e.target;
        const pos = marker.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
      });

      deliveryMarkerRef.current = deliveryMarker;

      // Polyline connecting Store to Delivery
      const polyline = L.polyline([storePos, deliveryPos], {
        color: '#ab1a15',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.8
      }).addTo(map);
      polylineRef.current = polyline;
    }

    // Map Click to move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setSelectedLat(lat);
      setSelectedLng(lng);
    });

    // Handle container resize
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [settings.storeLat, settings.storeLng]);

  // Invalidate map size whenever isVisible changes to true
  useEffect(() => {
    if (isVisible && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isVisible]);

  // Update marker positions & polyline when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const storePos: [number, number] = [settings.storeLat, settings.storeLng];
    const deliveryPos: [number, number] = [selectedLat, selectedLng];

    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setLatLng(deliveryPos);
    }

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([storePos, deliveryPos]);
    }
  }, [selectedLat, selectedLng, settings.storeLat, settings.storeLng]);

  // Address search via Nominatim
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addressInput.trim()) return;

    setGeocoding(true);
    setGeoError(null);

    try {
      const query = encodeURIComponent(addressInput.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setSelectedLat(lat);
        setSelectedLng(lon);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lon], 16);
        }
      } else {
        setGeoError('Endereço não localizado no mapa. Tente clicar diretamente no mapa ou incluir mais detalhes.');
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      setGeoError('Erro ao consultar endereço. Você pode clicar diretamente no mapa para marcar seu local.');
    } finally {
      setGeocoding(false);
    }
  };

  // Reverse Geocoding helper
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const road = data.address.road || data.address.pedestrian || '';
          const houseNumber = data.address.house_number || '';
          const neighbourhood = data.address.suburb || data.address.neighbourhood || data.address.city_district || '';
          const city = data.address.city || data.address.town || data.address.village || '';
          const state = data.address.state || '';
          
          const parts = [road, houseNumber ? `nº ${houseNumber}` : '', neighbourhood, city].filter(Boolean);
          const formatted = parts.length > 0 ? parts.join(', ') : (data.display_name || '');
          if (formatted) {
            setAddressInput(formatted);
          }
          return {
            road,
            houseNumber,
            neighborhood: neighbourhood,
            city,
            state,
            formatted
          };
        }
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
    return null;
  };

  // HTML5 Geolocation Execution
  const executeGpsRequest = (highAccuracy = true) => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setGeocoding(true);
    setGeoError(null);
    setIsIosBlocked(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSelectedLat(lat);
        setSelectedLng(lng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17);
        }
        const geoInfo = await fetchAddressFromCoords(lat, lng);
        setGeocoding(false);
        setShowIosPromptModal(false);

        if (onLocationSelect) {
          const dist = calculateHaversineDistance(settings.storeLat, settings.storeLng, lat, lng);
          const feeResult = calculateDeliveryFee(dist, subtotal, settings);
          onLocationSelect({
            lat,
            lng,
            address: geoInfo?.formatted || addressInput,
            distanceKm: dist,
            fee: feeResult.fee,
            tierLabel: feeResult.tierLabel,
            isOutOfRange: feeResult.isOutOfRange,
            street: geoInfo?.road || '',
            houseNumber: geoInfo?.houseNumber || '',
            neighborhood: geoInfo?.neighborhood || '',
            city: geoInfo?.city || '',
            state: geoInfo?.state || '',
            isGpsLocate: true
          });
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        let msg = 'Não foi possível obter sua localização GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          if (isIosDevice) {
            setIsIosBlocked(true);
            msg = 'A permissão de GPS foi negada ou bloqueada no seu iPhone. Veja o passo a passo abaixo para liberar no Safari/iPhone.';
          } else {
            msg = 'Permissão de localização foi bloqueada no navegador. Por favor, libere o acesso à localização ou escolha seu ponto no mapa.';
          }
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Sinal de localização (GPS) indisponível no momento. Toque diretamente no mapa para marcar seu endereço.';
        } else if (err.code === err.TIMEOUT) {
          if (highAccuracy) {
            // Retry with low accuracy (useful indoors on iOS)
            executeGpsRequest(false);
            return;
          }
          msg = 'Tempo limite esgotado ao tentar obter o GPS. Tente novamente ou busque o endereço no mapa.';
        }
        setGeoError(msg);
        setGeocoding(false);
      },
      { enableHighAccuracy: highAccuracy, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleUseCurrentLocation = () => {
    if (isIosDevice) {
      setShowIosPromptModal(true);
    } else {
      executeGpsRequest(true);
    }
  };

  return (
    <div className="space-y-2.5 w-full">
      {/* GPS Button */}
      {!hideTopGpsButton && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={geocoding}
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            title="Usar GPS do meu dispositivo"
          >
            {geocoding ? (
              <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Navigation className="h-4 w-4 text-brand-green" />
            )}
            <span>{geocoding ? 'Obtendo GPS...' : 'Usar Meu GPS'}</span>
          </button>
        </div>
      )}

      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* iPhone iOS Permission Blocked Instructions */}
      {isIosBlocked && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl text-xs space-y-2.5 border border-slate-800 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
            <Smartphone className="h-4 w-4 shrink-0" />
            <span>Passo a passo para liberar o GPS no seu iPhone:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 font-medium">
            <li>Abra o aplicativo ⚙️ <strong>Ajustes</strong> do iPhone.</li>
            <li>Vá em <strong>Privacidade e Segurança</strong> &gt; <strong>Serviços de Localização</strong>.</li>
            <li>Selecione o <strong>Safari</strong> (ou seu navegador atual).</li>
            <li>Marque <strong>"Durante o Uso do App"</strong> e ative <strong>"Localização Exata"</strong>.</li>
            <li>Retorne aqui e toque no botão abaixo:</li>
          </ol>
          <button
            type="button"
            onClick={() => executeGpsRequest(true)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98"
          >
            <Navigation className="h-4 w-4" />
            <span>🔄 Autorizei! Tentar GPS Novamente</span>
          </button>
        </div>
      )}

      {/* iPhone iOS Authorization Modal */}
      {showIosPromptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Smartphone className="h-8 w-8 text-emerald-600 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                📱 Autorização de GPS no iPhone
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                O iOS / Safari solicitará sua autorização de localização. Toque em <strong className="text-emerald-700">"Permitir"</strong> ou <strong className="text-emerald-700">"Permitir Durante o Uso"</strong> para preenchermos seu endereço exato automaticamente.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeGpsRequest(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                <span>Autorizar e Buscar Meu GPS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowIosPromptModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                Escolher Ponto Manualmente no Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Map Floating Distance & Fee Card */}
        {!isStorePicker && (
          <div className="absolute top-2 right-2 z-10 bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200/80 shadow-md text-xs max-w-[220px] sm:max-w-[260px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
              <span className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <span>📏 Distância:</span>
              </span>
              <span className="font-black text-brand-green text-xs">
                {(Number(distanceKm) || 0).toFixed(1)} km
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-600 text-[11px]">Taxa Calculada:</span>
              <span className={`font-black text-xs ${feeResult.isOutOfRange ? 'text-red-600' : 'text-slate-900'}`}>
                {feeResult.fee === 0 ? 'GRÁTIS' : `R$ ${(Number(feeResult.fee) || 0).toFixed(2).replace('.', ',')}`}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 font-medium mt-1 leading-tight line-clamp-2">
              {feeResult.tierLabel}
            </div>
          </div>
        )}

        {/* Map Tip Overlay */}
        <div className="absolute bottom-2 left-2 z-10 bg-slate-900/80 text-white backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-medium shadow-xs flex items-center gap-1 pointer-events-none">
          <Info className="h-3 w-3 text-amber-400" />
          <span>Toque ou arraste o pino 🛵 para ajustar o local exato</span>
        </div>
      </div>
    </div>
  );
};
