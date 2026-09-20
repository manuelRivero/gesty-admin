/* Storefront order push — scope: / */

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

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

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      data: { url, orderId: data.orderId, slug: data.slug, status: data.status },
    }),
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
