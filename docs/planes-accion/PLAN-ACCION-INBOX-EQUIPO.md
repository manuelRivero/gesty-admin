# Plan de acción — Inbox de equipo (WhatsApp)

**Estado:** propuesto (no implementado)  
**Fecha:** 2026-09-06  
**Repos:** `gesty-admin` (UI) + `gesty-backend` (API / socket / persistencia)  
**Contexto:** gap #1 en `docs/investigacion/gesty-vs-mercado-gaps.md`. El local laboratorio opera con muchos grupos de WhatsApp y comunicaciones que se pierden; el handoff humano sin ownership empeora eso.  
**Catálogo comercial:** IDs `WA-07` … `WA-11` en `docs/FEATURES.md`.  
**Brief para backend:** `CONTEXTO-BACKEND-INBOX-EQUIPO.md` (copiar a gesty-backend; este plan UI se actualizará con el output de allá).  
**Objetivo:** *Que 2–4 personas del local puedan atender chats de soporte sin pisarse, con contexto interno y respuestas rápidas — sin convertirnos en WATI.*

---

## 1. Por qué este plan

Hoy `/messages` es una **bandeja compartida 1:1 bot↔humano**:

- Listar chats, filtrar por sentimiento, responder con bot OFF  
- Alertas de soporte + sentimiento en realtime  
- Handoff manual y auto-reactivación del bot por timeout  

**No hay:** asignación, notas internas, respuestas rápidas, quién envió el mensaje admin, ni anti-colisión.

Eso alcanza para un dueño solo. Falla cuando hay varios ADMIN/OWNER (o sala) mirando el mismo chat — el caso del laboratorio.

Este plan define **MVP operativo** (fase A–C) y deja fuera features de suite genérica (SLA enterprise, omnicanal, presence completa tipo Slack).

---

## 2. Invariantes a respetar

| # | Invariante |
|---|------------|
| I1 | `bot_enabled` **global** (Settings) = kill switch del canal. No mezclar con handoff por chat. |
| I2 | `botEnabled` **por conversación** = handoff. El input humano solo con bot OFF (como hoy). |
| I3 | Mensajes al cliente con `skipHumanTakeover: true` solo en reengage bot (manual o auto). Los mensajes humanos hacen takeover. |
| I4 | **Notas internas nunca salen a WhatsApp.** Distinción visual inequívoca en UI. |
| I5 | Asignar un chat **no** apaga el bot solo. El humano debe poner bot OFF (o el backend define una regla explícita documentada — preferimos no auto-magic). |
| I6 | Auto-reactivación por timeout (`whatsapp.bot_auto_reactivated`) sigue válida; al volver el bot, la asignación puede quedar histórica o limpiarse (decidir en backend; UI debe reflejarlo). |
| I7 | Acknowledge de “soporte pedido” debe ser **durable** (no solo estado React local). |
| I8 | No inventar unread/online falsos nuevos; si se muestran, que vengan del backend. |

---

## 3. Qué hay hoy (baseline)

| Pieza | Estado |
|-------|--------|
| `GET/PATCH` conversaciones, mensajes, bot por chat | ✅ |
| Socket: `message_created`, `support_requested`, `bot_auto_reactivated`, `sentiment_updated` | ✅ |
| UI lista + chat + toggle bot + banner sentimiento | ✅ |
| Acceso: solo `ADMIN` / `OWNER` | ✅ |
| Asignación / notas / canned / autor admin / claim | ❌ |
| `STAFF` en inbox | ❌ (bloqueado) |

Referencia código: `app/(dashboard)/messages/page.tsx`, `components/messages/*`, `lib/requests/messages.ts`, `contexts/admin-socket-context.tsx`.

---

## 4. Alcance por fases

### Fase A — Ownership mínimo (desbloquear operación en paralelo)

**Problema que resuelve:** dos personas contestan lo mismo / nadie sabe de quién es el chat.

**Backend (gesty-backend):**

1. Campo en conversación: `assignedUserId` / `assignedUser` (nullable) + `assignedAt`.
2. `PATCH /admin/whatsapp/conversations/:id/assignment`  
   - body: `{ userId: string | null }` (null = desasignar)  
   - solo usuarios del business con rol permitido (ver §5).
3. Filtro en listado: `assignedTo=me|unassigned|<userId>|all`.
4. Incluir assignee en `GET conversations` y en eventos socket relevantes (`message_created` / nuevo `whatsapp.conversation_updated`).
5. Persistencia de **ack de soporte**: al “tomar” o al abrir con claim, limpiar `support_requested` para todos los clientes (evento o flag en conversación).
6. En mensajes outbound admin: guardar `sentByUserId` + nombre para mostrar en bubble.

**Admin UI:**

1. En header del chat: selector “Asignado a: Yo / … / Sin asignar”.
2. En lista: avatar/inicial del assignee + filtro chips: **Todos | Míos | Sin asignar | Soporte**.
3. Acción rápida desde alerta de soporte: **“Tomar chat”** = assign a mí + (opcional) bot OFF si ya estaba en handoff — *sin* apagar bot si el chat seguía en bot, salvo confirmación.
4. Bubble admin: “Vos” / nombre del colega (no solo ícono genérico).

**Criterio de éxito A:** en el laboratorio, un chat de soporte tiene dueño visible; el otro admin ve a quién está asignado sin preguntar por el grupo interno.

---

### Fase B — Anti-colisión liviana + notas internas

**Problema que resuelve:** pisarse al escribir; perder instrucciones que hoy viven en grupos.

**Backend:**

1. **Vista / claim suave (no lock duro):**  
   - `POST/DELETE` o socket: “user X está viendo conversation Y”  
   - Evento: `whatsapp.conversation_viewers` `{ conversationId, viewers: [{ userId, name }] }`  
   - TTL corto (p.ej. 30–60s sin heartbeat).
2. **Notas internas:**  
   - `GET/POST /admin/whatsapp/conversations/:id/notes`  
   - `{ id, body, createdBy, createdAt }` — nunca se envían a Meta.  
   - Opcional fase B+: `@mención` notifica in-app al usuario.

**Admin UI:**

1. Banner si otro usuario está en el mismo chat: “María también está mirando este chat”.
2. Panel lateral o hilo “Notas del equipo” (estilo interno, color distinto al WhatsApp).
3. Al tomar un chat de soporte, hint: “Dejá una nota si pasás el caso”.

**Criterio de éxito B:** las instrucciones (“cliente VIP”, “ya le ofrecimos postre”, “esperar comprobante”) viven en el chat, no en un grupo paralelo.

---

### Fase C — Respuestas rápidas (canned)

**Problema que resuelve:** mismo texto una y otra vez (horarios, alias de transferencia, “tu pedido va en camino”).

**Backend:**

1. CRUD a nivel business: `/admin/whatsapp/canned-replies`  
   - `{ id, title, body, shortcut? }`  
2. Al usar una canned, el envío sigue siendo `POST .../messages` normal (mismo takeover).

**Admin UI:**

1. Settings o sección en Mensajes: gestionar respuestas rápidas.
2. En `MessageInput`: botón `/` o chips con las más usadas; inserta texto (editable antes de enviar).
3. Semillas sugeridas (no obligatorias): horario, alias/CBU, “pedido en preparación”, “¿delivery o takeaway?”.

**Criterio de éxito C:** un STAFF/ADMIN responde un caso típico en &lt;2 toques sin reescribir el párrafo.

---

### Fase D — Acceso de equipo (roles) — *después de A–C estables*

| Rol | Propuesta |
|-----|-----------|
| `OWNER` / `ADMIN` | Inbox completo + gestionar canned + asignar a cualquiera |
| `STAFF` | Inbox: ver/responder/notas; asignarse a sí; **no** settings de canned globales (o solo uso) |
| `DELIVERY` | Sin inbox (sigue en Entregas) |
| `MANAGER` | Solo si se rehabilita el rol en `/users`; tratar como ADMIN light |

Requiere: `canAccessPath("/messages")` + permisos finos en API.

**No abrir STAFF al inbox antes de tener assignee + autor de mensaje** (si no, vuelve el caos con más gente).

---

## 5. Decisiones de producto (fijar antes de codear)

| # | Decisión | Recomendación |
|---|----------|---------------|
| D1 | ¿Asignar apaga el bot? | **No automático.** CTA: “Tomar y pasar a humano” (assign + bot OFF) vs “Solo asignar”. |
| D2 | ¿Unassigned + bot ON es válido? | **Sí** — el bot atiende; humanos miran cola de soporte. |
| D3 | ¿Lock duro al escribir? | **No en MVP.** Solo viewers + disciplina de assignee. Lock duro = fase E si hace falta. |
| D4 | ¿Notas visibles para el cliente? | **Nunca.** |
| D5 | ¿Comparar con WATI en landing? | **No.** Esto es ops interna; no presumir “mejor inbox del mercado”. |
| D6 | Ficha del cliente al lado del chat | Gap #3 — **fuera de este plan** (puede engancharse después al panel lateral de notas). |

---

## 6. Contrato API / socket (borrador para backend)

### REST (nuevo o extendido)

```
PATCH /admin/whatsapp/conversations/:id/assignment
  body: { userId: string | null }
  → conversation con assignedUser

GET  /admin/whatsapp/conversations?assignedTo=me|unassigned|<uuid>&support=1&...

GET  /admin/whatsapp/conversations/:id/notes
POST /admin/whatsapp/conversations/:id/notes  { body: string }

GET/POST/PATCH/DELETE /admin/whatsapp/canned-replies

POST /admin/whatsapp/conversations/:id/support/ack   # durable
```

### Socket (nuevo o extendido)

| Evento | Uso |
|--------|-----|
| `whatsapp.conversation_updated` | assignee, support flag, bot state batch |
| `whatsapp.conversation_viewers` | anti-colisión liviana |
| `whatsapp.note_created` | notas en vivo para quien tiene el chat abierto |
| `whatsapp.message_created` | + `sentByUserId`, `sentByName` cuando sender=admin |

### Campos a agregar en list item

- `assignedUser: { id, name } | null`
- `supportRequestedAt: string | null` (o boolean durable)
- mensajes admin: `sentByUserId`, `sentByName`

---

## 7. Alcance UI (gesty-admin) — checklist de implementación

### 7.1 Lista (`chat-list` / `chat-item`)

- [ ] Filtros: Todos / Míos / Sin asignar / Soporte  
- [ ] Badge assignee  
- [ ] Mantener sentimiento + búsqueda por nombre  

### 7.2 Ventana (`chat-window`)

- [ ] Selector de asignación  
- [ ] CTA “Tomar chat” / “Tomar y pasar a humano”  
- [ ] Banner viewers  
- [ ] Panel notas  
- [ ] Bubble con nombre del admin  

### 7.3 Input (`message-input`)

- [ ] Canned replies (fase C)  
- [ ] Emoji/adjunto: fuera de alcance salvo que backend ya soporte media  

### 7.4 Realtime / header

- [ ] Consumir `conversation_updated` / viewers / notes  
- [ ] Ack de soporte durable al tomar o al abrir (definir una sola regla)  
- [ ] Toast de soporte: acción primaria “Tomar”  

### 7.5 Settings (fase C)

- [ ] ABM respuestas rápidas del local  

---

## 8. Fuera de alcance (explícito)

- Omnicanal, broadcasts, templates marketing Meta  
- SLA timers / reportes de productividad de agentes  
- Presence “en línea” del cliente o read receipts WhatsApp  
- Lock exclusivo tipo ticket (fase E solo si el laboratorio lo pide)  
- Copilot IA que redacta respuestas (gap IA aparte)  
- Migrar grupos de WhatsApp del laboratorio a Gesty (cambio de proceso, no feature)  
- Ficha CRM del cliente en el chat (gap #3)  

---

## 9. Orden de trabajo sugerido

```
1. Backend Fase A (assignment + autor mensaje + support ack)
2. Admin UI Fase A
3. Probar en local laboratorio (2 usuarios reales)
4. Backend + UI Fase B (viewers + notas)
5. Backend + UI Fase C (canned)
6. Fase D (STAFF) solo si A–C estabilizaron el caos
```

**No** abrir más roles al inbox antes de ownership.

---

## 10. Criterio de éxito global

1. Un chat de soporte tiene **dueño visible** para todo el equipo.  
2. Dos humanos ven si el otro está en el mismo chat (o al menos a quién está asignado).  
3. Las instrucciones operativas viven en **notas internas**, no solo en grupos externos.  
4. Respuestas repetidas se mandan con **canned**, sin copy-paste eterno.  
5. El handoff bot↔humano y el timeout **siguen funcionando** igual que hoy (I1–I3).  

---

## 11. Siguiente paso inmediato

1. Copiar/alinear este doc con un plan espejo en `gesty-backend` (modelo + endpoints + eventos).  
2. Fijar D1–D3 con el dueño del producto (laboratorio).  
3. Empezar **solo Fase A** end-to-end; no mezclar notas/canned en el primer PR.
