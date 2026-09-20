"use client"

import * as React from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/components/delivery-zones/types"
import type { ShoppingMapCenter } from "@/components/shopping/types"
import { cn } from "@/lib/utils"

export type DestinationCoords = {
  latitude: number
  longitude: number
}

export type DestinationPinMapInnerProps = {
  mapCenter: ShoppingMapCenter | null | undefined
  value: DestinationCoords | null
  onChange: (coords: DestinationCoords) => void
  disabled?: boolean
  className?: string
  /** Remonta / invalida tamaño (p. ej. al abrir el sheet). */
  active?: boolean
}

const DESTINATION_ZOOM = 16

function toLatLng(
  center: ShoppingMapCenter | null | undefined,
): [number, number] {
  if (
    center &&
    Number.isFinite(center.latitude) &&
    Number.isFinite(center.longitude)
  ) {
    return [center.latitude, center.longitude]
  }
  return DEFAULT_MAP_CENTER
}

function almostSame(
  a: { lat: number; lng: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.abs(a.lat - b.latitude) < 1e-7 &&
    Math.abs(a.lng - b.longitude) < 1e-7
  )
}

function refreshMapSize(map: ReturnType<typeof L.map>) {
  // Leaflet en sheet: sin invalidateSize tras setView/GPS queda gris/blanco.
  map.invalidateSize({ animate: false })
  window.requestAnimationFrame(() => {
    map.invalidateSize({ animate: false })
  })
  window.setTimeout(() => {
    map.invalidateSize({ animate: false })
  }, 150)
}

/**
 * Mapa de destino: el local solo centra el viewport.
 * No hay pin hasta click o `value` externo (GPS).
 */
export function DestinationPinMapInner({
  mapCenter,
  value,
  onChange,
  disabled = false,
  className,
  active = true,
}: DestinationPinMapInnerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<ReturnType<typeof L.map> | null>(null)
  const markerRef = React.useRef<ReturnType<typeof L.marker> | null>(null)
  const onChangeRef = React.useRef(onChange)
  const disabledRef = React.useRef(disabled)
  const mapCenterRef = React.useRef(mapCenter)
  onChangeRef.current = onChange
  disabledRef.current = disabled
  mapCenterRef.current = mapCenter

  const pinIcon = React.useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0a0a0a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    [],
  )

  const placeOrMoveMarker = React.useCallback(
    (coords: DestinationCoords, emit: boolean) => {
      const map = mapRef.current
      if (!map) return

      const latlng: [number, number] = [coords.latitude, coords.longitude]

      if (!markerRef.current) {
        const marker = L.marker(latlng, {
          draggable: !disabledRef.current,
          icon: pinIcon,
          autoPan: true,
        }).addTo(map)
        marker.on("dragend", () => {
          const p = marker.getLatLng()
          onChangeRef.current({ latitude: p.lat, longitude: p.lng })
        })
        markerRef.current = marker
      } else if (!almostSame(markerRef.current.getLatLng(), coords)) {
        markerRef.current.setLatLng(latlng)
      }

      // Sin animate: evita tiles rotos dentro del sheet bottom.
      map.setView(latlng, DESTINATION_ZOOM, { animate: false })
      refreshMapSize(map)

      if (emit) {
        onChangeRef.current(coords)
      }
    },
    [pinIcon],
  )

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const viewport = toLatLng(mapCenterRef.current)
    const map = L.map(containerRef.current, {
      center: viewport,
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
      if (disabledRef.current) return
      placeOrMoveMarker(
        { latitude: e.latlng.lat, longitude: e.latlng.lng },
        true,
      )
    })

    mapRef.current = map
    refreshMapSize(map)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !active) return
    const timer = window.setTimeout(() => refreshMapSize(map), 80)
    return () => window.clearTimeout(timer)
  }, [active])

  React.useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    if (disabled) {
      marker.dragging?.disable()
    } else {
      marker.dragging?.enable()
    }
  }, [disabled])

  const valueKey = value
    ? `${value.latitude.toFixed(6)},${value.longitude.toFixed(6)}`
    : ""

  // Solo reacciona a cambios reales de destino (GPS / clear / click).
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!value) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      map.setView(toLatLng(mapCenterRef.current), DEFAULT_MAP_ZOOM, {
        animate: false,
      })
      refreshMapSize(map)
      return
    }

    placeOrMoveMarker(value, false)
  }, [valueKey, placeOrMoveMarker, value])

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-muted relative z-0 h-52 w-full overflow-hidden rounded-lg border",
        disabled && "pointer-events-none",
        className,
      )}
      aria-label="Mapa para marcar el destino de entrega"
    />
  )
}
