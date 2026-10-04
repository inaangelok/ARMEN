import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection } from "geojson";
import { GeoJSON, MapContainer, Marker, Pane, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Map as MapIcon, Route } from "lucide-react";
import { toneFill } from "@/presentation/lib/tone";
import type { FleetRow } from "@/domain/model";
import basemapData from "@/presentation/lib/map/armenia-basemap.json";
import { PLACES, type Lang } from "@/presentation/lib/map/places";

/**
 * Fleet map.
 *
 * Two layers:
 *  1. A built-in map of Armenia (provinces, Lake Sevan, rivers, main roads, place names) drawn from
 *     bundled Natural Earth data. It needs no network, so the map always shows, even offline or where
 *     tile servers are blocked.
 *  2. Optional street-map tiles on top (OpenStreetMap by default). Set VITE_MAP_TILE_URL to use your own
 *     tile provider, or VITE_MAP_TILE_URL=off to use the built-in map only.
 */
const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim() || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined)?.trim() || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILES_AVAILABLE = TILE_URL.toLowerCase() !== "off";
const BASEMAP = basemapData as unknown as FeatureCollection;
const MODE_KEY = "armen-care-map-mode";

const TONE = { ok: "ok", warning: "warn", critical: "crit", offline: "muted" } as const;
const SIZE_PX = { S30: 26, M60: 32, L100: 38 };

function pin(row: FleetRow) {
  const color = toneFill[TONE[row.status]];
  const s = SIZE_PX[row.station.size];
  const label = row.station.size.replace(/\D/g, "");
  return L.divIcon({
    className: "armen-pin",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div style="width:${s}px;height:${s}px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${s > 30 ? 11 : 10}px 'Plus Jakarta Sans',sans-serif">${label}</div>`,
  });
}

// Styles for the built-in map, by feature kind.
function featureStyle(f?: Feature): L.PathOptions {
  const p = (f?.properties ?? {}) as { k?: string; iso?: string; type?: string };
  switch (p.k) {
    case "country":
      return p.iso === "ARM"
        ? { stroke: true, color: "#7FA392", weight: 1.6, fillColor: "#F7F9F6", fillOpacity: 1 }
        : { stroke: true, color: "#C9D3CD", weight: 1, fillColor: "#E6EBE7", fillOpacity: 1 };
    case "marz":
      return { color: "#B9CABF", weight: 1, dashArray: "4 4", fill: false };
    case "lake":
      return { stroke: true, color: "#9CC3DA", weight: 1, fillColor: "#CFE3EF", fillOpacity: 1 };
    case "river":
      return { color: "#A9CCE0", weight: 1.2 };
    case "road":
      return p.type === "Major Highway" ? { color: "#E2C88F", weight: 2.2 } : { color: "#E7D7B3", weight: 1.4 };
    default:
      return { weight: 0, fill: false };
  }
}

function placeIcon(text: string, kind: string) {
  const style =
    kind === "marz"
      ? "font:600 10px 'Plus Jakarta Sans','Noto Sans Armenian','Noto Sans',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8DA79A"
      : kind === "lake"
        ? "font:italic 500 11px 'Plus Jakarta Sans','Noto Sans Armenian','Noto Sans',sans-serif;color:#5D8FAE"
        : kind === "capital"
          ? "font:700 13px 'Plus Jakarta Sans','Noto Sans Armenian','Noto Sans',sans-serif;color:#22382F"
          : `font:600 ${kind === "city" ? 11.5 : 11}px 'Plus Jakarta Sans','Noto Sans Armenian','Noto Sans',sans-serif;color:#36604F`;
  const dot = kind === "capital" || kind === "city" || kind === "town";
  return L.divIcon({
    className: "armen-pin",
    iconSize: [0, 0],
    html:
      (dot ? `<span style="position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:9px;background:#36604F;border:1.5px solid #fff"></span>` : "") +
      `<span style="position:absolute;transform:translate(-50%,${dot ? "-150%" : "-50%"});white-space:nowrap;${style};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">${text}</span>`,
  });
}

// Keep Leaflet's size in sync when the card is resized by the page layout.
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Fit({ rows }: { rows: FleetRow[] }) {
  const map = useMap();
  useEffect(() => {
    if (!rows.length) return;
    map.fitBounds(L.latLngBounds(rows.map((r) => [r.station.lat, r.station.lng])), { padding: [30, 30], maxZoom: 12 });
  }, [rows, map]);
  return null;
}

function PlaceLabels({ lang }: { lang: Lang }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return (
    <>
      {PLACES.filter((p) => (p.kind === "marz" ? zoom <= 9 : zoom >= p.minZoom)).map((p) => (
        <Marker key={p.kind + p.name.en} pane="armen-labels" position={[p.lat, p.lng]} interactive={false} keyboard={false} icon={placeIcon(p.name[lang], p.kind)} />
      ))}
    </>
  );
}

function readMode(): "street" | "schematic" {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "street" || v === "schematic") return v;
  } catch {
    /* storage unavailable */
  }
  return TILES_AVAILABLE ? "street" : "schematic";
}

export function FleetMap({ rows }: { rows: FleetRow[] }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = (["hy", "en", "ru"].includes(i18n.language) ? i18n.language : "en") as Lang;
  const [mode, setMode] = useState<"street" | "schematic">(readMode);
  // If the tile server cannot be reached (offline, firewall, sandbox), fall back to the built-in map.
  const [tilesFailed, setTilesFailed] = useState(false);
  const tileStats = useMemo(() => ({ ok: 0, err: 0 }), []);
  const showTiles = TILES_AVAILABLE && mode === "street" && !tilesFailed;
  const maxBounds = useMemo(() => L.latLngBounds([38.2, 42.4], [41.9, 47.5]), []);

  const active = (m: "street" | "schematic") => (m === "street" ? showTiles : !showTiles);
  const choose = (m: "street" | "schematic") => {
    setMode(m);
    if (m === "street") {
      tileStats.ok = 0;
      tileStats.err = 0;
      setTilesFailed(false);
    }
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="relative h-[380px] overflow-hidden rounded-2xl border bg-[#E6EBE7] 2xl:h-full 2xl:min-h-[420px]">
      <MapContainer
        center={[40.3, 44.35]}
        zoom={10}
        minZoom={8}
        maxBounds={maxBounds}
        maxBoundsViscosity={0.8}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: "#E6EBE7" }}
        attributionControl
      >
        {/* Built-in map: sits under the tile layer, so it shows wherever tiles are missing. */}
        <Pane name="armen-base" style={{ zIndex: 150 }}>
          <GeoJSON data={BASEMAP} style={featureStyle} interactive={false} attribution='Map data: <a href="https://www.naturalearthdata.com/">Natural Earth</a>' />
        </Pane>
        <Pane name="armen-labels" style={{ zIndex: 160 }} />
        {!showTiles && <PlaceLabels lang={lang} />}
        {showTiles && (
          <TileLayer
            attribution={TILE_ATTRIBUTION}
            url={TILE_URL}
            eventHandlers={{
              tileload: () => {
                tileStats.ok += 1;
              },
              tileerror: () => {
                tileStats.err += 1;
                if (tileStats.ok === 0 && tileStats.err >= 3) setTilesFailed(true);
              },
            }}
          />
        )}
        <AutoResize />
        <Fit rows={rows} />
        {rows.map((r) => (
          <Marker key={r.station.id} position={[r.station.lat, r.station.lng]} icon={pin(r)} eventHandlers={{ click: () => navigate(`/ops/stations/${r.station.id}`) }} keyboard>
            <Tooltip direction="top" offset={[0, -12]}>
              <b>{r.station.name}</b>
              <br />
              {r.station.size} · SOH {r.snapshot?.soh ?? "—"}% · {t(`stationStatus.${r.status}`)}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {TILES_AVAILABLE && (
        <div className="absolute right-2 top-2 z-[400] flex overflow-hidden rounded-lg border bg-background/95 text-[11px] font-medium shadow" role="group" aria-label={t("fleet.mapView")}>
          {(
            [
              ["street", Route, t("fleet.mapStreet")],
              ["schematic", MapIcon, t("fleet.mapSchematic")],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => choose(m)}
              aria-pressed={active(m)}
              className={`flex items-center gap-1 px-2 py-1 transition-colors ${active(m) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex flex-wrap gap-2 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-medium shadow">
        {(["ok", "warning", "critical", "offline"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: toneFill[TONE[s]] }} />
            {t(`stationStatus.${s}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
