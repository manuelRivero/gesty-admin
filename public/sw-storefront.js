/* Storefront order push — scope: / */
/* v3: icon absolute + force clients to re-fetch SW */

var PUSH_ICON_PATH = "/food-notification-icon.png"
var PUSH_BADGE_PATH = "/food-notification-badge.png"

function absoluteAsset(path) {
  var base =
    (self.registration && self.registration.scope) || self.location.origin
  try {
    return new URL(path, base).href
  } catch (e) {
    return path
  }
}

async function parsePushData(event) {
  if (!event.data) return {}
  try {
    var text = await event.data.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch (e) {
    return {}
  }
}

self.addEventListener("install", function (event) {
  // Activa ya el SW nuevo (no esperar a cerrar todas las pestañas).
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", function (event) {
  event.waitUntil(
    (async function () {
      var data = await parsePushData(event)

      var title =
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : "Actualización de tu pedido"
      var body =
        typeof data.body === "string" && data.body.trim()
          ? data.body.trim()
          : "Tocá para ver el estado."
      var url =
        typeof data.url === "string" && data.url.trim()
          ? data.url.trim()
          : "/"
      var tag =
        typeof data.tag === "string" && data.tag.trim()
          ? data.tag.trim()
          : data.orderId
            ? "gesty-order-" + data.orderId
            : "gesty-order"

      // Siempre absolutas desde el origin del SW (Chrome Android ignora relativas → "G").
      var icon = absoluteAsset(PUSH_ICON_PATH)
      var badge = absoluteAsset(PUSH_BADGE_PATH)
      if (
        typeof data.icon === "string" &&
        /^https:\/\//i.test(data.icon.trim())
      ) {
        icon = data.icon.trim()
      }

      await self.registration.showNotification(title, {
        body: body,
        tag: tag,
        icon: icon,
        badge: badge,
        renotify: true,
        requireInteraction: false,
        data: {
          url: url,
          orderId: data.orderId,
          slug: data.slug,
          status: data.status,
        },
      })
    })(),
  )
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  var rawUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/"
  var targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    (async function () {
      var clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (var i = 0; i < clientsList.length; i++) {
        var client = clientsList[i]
        if ("focus" in client) {
          await client.focus()
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl)
              return
            } catch (e) {
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
