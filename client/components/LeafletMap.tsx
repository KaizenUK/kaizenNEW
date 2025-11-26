import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export const LeafletMap = ({
  center = [53.391, -3.017],
  zoom = 9,
  className = "",
}: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance.current);

    const liverpoollCoords: [number, number] = [53.4084, -2.9916];
    const wirralCoords: [number, number] = [53.4011, -3.1114];

    const createIcon = (color: "cyan" | "lime") => {
      const colorMap = {
        cyan: "#06b6d4",
        lime: "#84cc16",
      };
      return L.divIcon({
        html: `
          <div style="
            background-color: ${colorMap[color]};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [30, 30],
        className: "custom-marker",
      });
    };

    L.marker(liverpoollCoords, { icon: createIcon("cyan") })
      .bindPopup("<strong>Liverpool</strong><br>Merseyside")
      .addTo(mapInstance.current);

    L.marker(wirralCoords, { icon: createIcon("lime") })
      .bindPopup("<strong>Wirral</strong><br>Merseyside")
      .addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [center, zoom]);

  return <div ref={mapRef} className={className} />;
};
