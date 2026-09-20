/* Storefront order push — scope: / */

/** Paths relativos en /public — siempre se absolutizan al origin del SW. */
var PUSH_ICON_PATH = "/food-notification-icon.png"
var PUSH_BADGE_PATH = "/food-notification-badge.png"

function absoluteAsset(path) {
  try {
    return new URL(path, self.location.origin).href
  } catch {
    return path
  }
}

async function parsePushData(event) {
  if (!event.data) return {}
  try {
    const text = await event.data.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch {
    return {}
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const data = await parsePushData(event)

      const title =
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : "Actualización de tu pedido"
      const body =
        typeof data.body === "string" && data.body.trim()
          ? data.body.trim()
          : "Tocá para ver el estado."
      const url =
        typeof data.url === "string" && data.url.trim()
          ? data.url.trim()
          : "/"
      const tag =
        typeof data.tag === "string" && data.tag.trim()
          ? data.tag.trim()
          : data.orderId
            ? `gesty-order-${data.orderId}`
            : "gesty-order"

      // Chrome Android en eventos `push` suele fallar con path relativo → monograma "G".
      const icon =
        typeof data.icon === "string" && /^https?:\/\//i.test(data.icon.trim())
          ? data.icon.trim()
          : absoluteAsset(PUSH_ICON_PATH)
      const badge = absoluteAsset(PUSH_BADGE_PATH)

      await self.registration.showNotification(title, {
        body,
        tag,
        icon,
        badge,
        renotify: true,
        requireInteraction: false,
        data: {
          url,
          orderId: data.orderId,
          slug: data.slug,
          status: data.status,
        },
      })
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const rawUrl =
    event.notification?.data?.url &&
    typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/"
  const targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus()
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl)
              return
            } catch {
              /* fall through */
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
