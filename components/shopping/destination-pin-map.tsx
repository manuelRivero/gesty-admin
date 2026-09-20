"use client"

import dynamic from "next/dynamic"

import type { DestinationPinMapInnerProps } from "./destination-pin-map-inner"

export type { DestinationCoords } from "./destination-pin-map-inner"

/** Leaflet solo en cliente (tiles + DOM). */
export const DestinationPinMap = dynamic(
  () =>
    import("./destination-pin-map-inner").then((mod) => mod.DestinationPinMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted text-muted-foreground flex h-52 w-full items-center justify-center rounded-lg border text-sm">
        Cargando mapa…
      </div>
    ),
  },
)

export type DestinationPinMapProps = DestinationPinMapInnerProps
