/**
 * Geolocalización del navegador para el pin de entrega (storefront).
 */

export type BrowserLocationResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number | null }
  | {
      ok: false
      reason: "unsupported" | "denied" | "unavailable" | "timeout" | "unknown"
      message: string
    }

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 30_000,
}

function mapGeoError(error: GeolocationPositionError): BrowserLocationResult {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        ok: false,
        reason: "denied",
        message:
          "No tenemos permiso para usar tu ubicación. Podés marcar el destino en el mapa.",
      }
    case error.POSITION_UNAVAILABLE:
      return {
        ok: false,
        reason: "unavailable",
        message:
          "No pudimos obtener tu ubicación. Tocá el mapa para marcar el destino.",
      }
    case error.TIMEOUT:
      return {
        ok: false,
        reason: "timeout",
        message:
          "Tardó demasiado en ubicar. Tocá el mapa o reintentá.",
      }
    default:
      return {
        ok: false,
        reason: "unknown",
        message:
          "No pudimos usar tu ubicación. Tocá el mapa para marcar el destino.",
      }
  }
}

export function requestBrowserLocation(): Promise<BrowserLocationResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve({
      ok: false,
      reason: "unsupported",
      message:
        "Este dispositivo no permite ubicación. Tocá el mapa para marcar el destino.",
    })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        })
      },
      (err) => resolve(mapGeoError(err)),
      GEO_OPTIONS,
    )
  })
}
