'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import type { ResidenceWithRelations } from '@/lib/types';
import { formatXof } from '@/lib/format';

// note : carte Leaflet + tuiles OpenStreetMap, thème clair Kaza (globals.css).
// Rendu client uniquement (window), marqueurs customisés aux couleurs Kaza.

// Échappement HTML minimal avant toute injection dans le DOM (anti-XSS).
const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function ResidenceMap({
  residences,
  center,
  activeId,
  onSelect,
}: {
  residences: ResidenceWithRelations[];
  center?: { lat: number; lng: number };
  activeId?: string | null;
  onSelect?: (r: ResidenceWithRelations) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // initialisation une seule fois
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      center: center ? [center.lat, center.lng] : [6.3703, 2.3912], // Cotonou par défaut
      zoom: 12,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // synchronisation des marqueurs avec les données
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    const icon = (active: boolean) =>
      L.divIcon({
        className: '',
        html: `<div class="kaza-marker ${active ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 28],
        popupAnchor: [0, -26],
      });

    for (const r of residences) {
      seen.add(r.id);
      if (!r.lat || !r.lng) continue;
      if (!markersRef.current.has(r.id)) {
        const marker = L.marker([r.lat, r.lng], { icon: icon(r.id === activeId) }).addTo(map);
        const popup = L.popup({ closeButton: false, offset: [0, -4] });
        marker.bindPopup(popup);
        popup.setContent(
          `<strong style="color:#0F172A">${escHtml(r.title)}</strong><br/>
           <span style="color:#0E4728;font-weight:600">${formatXof(r.price_monthly)}</span> /mois<br/>
           <span style="color:#64748B">${escHtml(r.zone ?? '')} ${escHtml(r.city ?? '')}</span>`,
        );
        marker.on('click', () => onSelect?.(r));
        markersRef.current.set(r.id, marker);
      } else {
        const existing = markersRef.current.get(r.id);
        existing?.setIcon(icon(r.id === activeId));
        existing?.off('click').on('click', () => onSelect?.(r));
      }
    }
    // retrait des marqueurs disparus
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
  }, [residences, activeId, onSelect]);

  // recentrage quand la position change
  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], Math.max(mapRef.current.getZoom(), 13), { animate: true });
  }, [center]);

  return (
    <div ref={containerRef} className="h-full w-full" role="application" aria-label="Carte des logements disponibles" />
  );
}

export function MapPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-kaza-bg text-kaza-faint">
      <MapPin className="h-8 w-8" aria-hidden />
      <p className="text-sm">Carte en cours de chargement…</p>
    </div>
  );
}