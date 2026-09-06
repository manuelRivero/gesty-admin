# Features — catálogo comercial (gesty-admin)

**Para qué sirve:** listar lo que este repo entrega (o planea entregar) para **ofrecerlo al local de experimento / clientes** como mejora incluida o **remunerada**.  
**Mantener al día:** toda funcionalidad nueva o cambio de producto relevante se anota acá (ver rule `.cursor/rules/features-catalog.mdc`).  
**No es:** changelog git ni especificación técnica. Los planes viven en `docs/planes-accion/`.

---

## Cómo usar este archivo

| Campo | Significado |
|-------|-------------|
| **Estado** | `disponible` · `parcial` · `en desarrollo` · `propuesto` |
| **Ofrecible** | `sí` = se puede vender/cobrar o incluir en paquete · `interno` = no vender aún · `no` = no comercializar |
| **Remunerable** | `sí` = candidata a upgrade / add-on / proyecto pago · `incluido` = va en el plan base · `n/d` |
| **Plan** | Link a `docs/planes-accion/…` si aplica |

**Al cerrar una feature:** pasar a `disponible`, completar “Valor para el local” y “Cómo ofrecerlo”.

---

## Índice rápido

1. [Operación del local](#1-operación-del-local)  
2. [WhatsApp / bot / inbox](#2-whatsapp--bot--inbox)  
3. [Pagos](#3-pagos)  
4. [Equipo y accesos](#4-equipo-y-accesos)  
5. [Setup y onboarding](#5-setup-y-onboarding)  
6. [Analytics](#6-analytics)  
7. [Pipeline (aún no disponible)](#7-pipeline-aún-no-disponible)  

---

## 1. Operación del local

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| OPS-01 | Menú (ítems, categorías, variaciones, imagen) | disponible | sí | incluido | Vender por WhatsApp con carta real | `/menu-items` |
| OPS-02 | Enrichment IA del menú (sinónimos / keywords) | disponible | sí | sí (cuota IA / add-on) | El bot entiende mejor los platos | Depende de cuota billing IA |
| OPS-03 | Pedidos (estados, listado, realtime) | disponible | sí | incluido | Cocina/ops ven lo que entra por WA | `/orders` |
| OPS-04 | Delivery propio + asignación repartidor + QR entrega | disponible | sí | sí | Flota propia sin app externa | Roles `DELIVERY` |
| OPS-05 | Takeaway | disponible | sí | incluido | Retiro en local por WhatsApp | Toggle fulfillment |
| OPS-06 | Zonas de entrega en mapa + fees | disponible | sí | sí | Cobrar envío por zona | `/delivery-zones` |
| OPS-07 | Calibración tarifas vs PedidosYa | disponible | sí | sí | Decidir propia vs externa con datos | Vertical fuerte |
| OPS-08 | Delivery externo (PedidosYa) como modo | disponible | sí | sí | Alternativa a flota propia | Excluyente con delivery propio |
| OPS-09 | Reservas + reglas (lead time, duración, etc.) | disponible | sí | incluido | Mesas sin teléfono eterno | `/reservations` |
| OPS-10 | Mesas por ambientes | disponible | sí | incluido | Cupo real de sala | `/tables` |
| OPS-11 | Slots de reserva | disponible | sí | sí | Controlar franjas horarias | `/reservation-slots` |
| OPS-12 | Horarios del local | disponible | sí | incluido | Bot respeta apertura | `/hours` |
| OPS-13 | Promociones (composer + IA/audio) | parcial | interno | sí | Promos por WhatsApp | UI ok; **aún no aplican en pedidos** |
| OPS-14 | Check-in QR de reservas | parcial | no | n/d | Sala confirma llegada | **Mock — no ofrecer** |

---

## 2. WhatsApp / bot / inbox

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| WA-01 | Bot on/off (kill switch canal) | disponible | sí | incluido | Apagar automatización sin cortar el número | Settings |
| WA-02 | Personalidad del bot + humanizar | disponible | sí | sí | Tono alineado a la marca del local | |
| WA-03 | Pedidos / atención con local cerrado | disponible | sí | sí | No perder ventas fuera de horario | `orders_when_closed` / `operate_when_closed` |
| WA-04 | Handoff humano + timeout vuelta al bot | disponible | sí | incluido | Persona cuando hace falta | |
| WA-05 | Inbox básico (lista, chat, bot por conversación) | disponible | sí | incluido | Atender WA desde el panel | `/messages` |
| WA-06 | Sentimiento IA + alertas de soporte (realtime) | disponible | sí | sí | Priorizar clientes enojados / que piden humano | Toast + audio |
| WA-07 | Inbox de equipo — asignación | propuesto | sí | sí | Varios atienden sin pisarse | [PLAN](planes-accion/PLAN-ACCION-INBOX-EQUIPO.md) Fase A |
| WA-08 | Inbox de equipo — notas internas | propuesto | sí | sí | Instrucciones fuera de grupos caóticos | Plan Fase B |
| WA-09 | Inbox de equipo — anti-colisión (viewers) | propuesto | sí | sí | Ver si un colega ya está en el chat | Plan Fase B |
| WA-10 | Respuestas rápidas (canned) | propuesto | sí | sí | Menos copy-paste operativo | Plan Fase C |
| WA-11 | Inbox para rol STAFF | propuesto | sí | sí | Sala atiende sin ser OWNER | Plan Fase D |

---

## 3. Pagos

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| PAY-01 | Métodos: efectivo / transferencia / online | disponible | sí | incluido | Cobrar como un restó LATAM | `/payment-method-configs` |
| PAY-02 | Mercado Pago (online) | disponible | sí | sí | Checkout online en el flujo | `/online-payments` |
| PAY-03 | Comprobantes de transferencia por WA + revisión | disponible | sí | sí | Anti-fraude / menos ida y vuelta | Diferenciador LATAM |

---

## 4. Equipo y accesos

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| TEAM-01 | Usuarios y roles (OWNER, ADMIN, STAFF, DELIVERY) | disponible | sí | incluido | Permisos por puesto, no solo “agentes de chat” | `/users` |
| TEAM-02 | Billing / planes / trial (Stripe) | disponible | sí | n/d | Monetización SaaS | `/billing` — no es upsell al local lab como “feature ops” |

---

## 5. Setup y onboarding

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| SETUP-01 | Checklist “listo para vender” + empty states + gates pedidos | disponible | sí | incluido | Evitar local “a medias” vendiendo mal | [PLAN](planes-accion/PLAN-ACCION-ADMIN-CAPABILITIES-SETUP.md) |
| SETUP-02 | Wizard largo de onboarding | propuesto | sí | sí | Onboarding guiado premium | Fuera del plan setup actual |

---

## 6. Analytics

| ID | Feature | Estado | Ofrecible | Remunerable | Valor para el local | Notas |
|----|---------|--------|-----------|-------------|---------------------|-------|
| AN-01 | Dashboard ops (pedidos / reservas) | disponible | sí | incluido | Ver el día en un vistazo | `/` |
| AN-02 | Ranking clientes + top platos | disponible | sí | sí | Decisiones de carta y VIP | No vender como BI enterprise |

---

## 7. Pipeline (aún no disponible)

Features detectadas en investigación / gaps, **aún no productizadas**. Ofrecibles como roadmap pago al local experimento cuando se prioricen.

| ID | Feature | Estado | Ofrecible | Remunerable | Origen |
|----|---------|--------|-----------|-------------|--------|
| PIPE-01 | Ficha del cliente en el chat (pedidos/reserva/zona) | propuesto | sí | sí | Gap #3 `docs/investigacion/gesty-vs-mercado-gaps.md` |
| PIPE-02 | Recordatorios transaccionales (reserva, “en camino”) | propuesto | sí | sí | Gap #4 |
| PIPE-03 | Promociones aplicadas de punta a punta en pedidos | en desarrollo | sí | sí | Cierra OPS-13 |
| PIPE-04 | Copilot de respuesta para humanos en inbox | propuesto | sí | sí | Gap #5 — después de WA-07+ |
| PIPE-05 | Check-in QR real (reemplazar mock) | propuesto | sí | sí | Cierra OPS-14 |

**No ofrecer / no anotar como venta:** omnicanal IG/TikTok, CRM de deals, broadcasts masivos fríos, flow builder genérico tipo ManyChat (ver investigación).

---

## Plantilla para nuevas filas

```md
| XX-00 | Nombre corto | propuesto \| en desarrollo \| parcial \| disponible | sí \| interno \| no | sí \| incluido \| n/d | Una frase de valor | Link plan / ruta UI |
```

**Checklist al anotar:**

1. ¿El local lo percibe como mejora concreta? → si no, `interno`.  
2. ¿Se puede cobrar aparte o solo va en el plan? → `Remunerable`.  
3. ¿Hay plan de acción? → link en `docs/planes-accion/`.  
4. ¿Está a medias? → `parcial` y decir qué falta en Notas.

---

## Historial de actualizaciones

| Fecha | Qué se anotó |
|-------|----------------|
| 2026-09-06 | Alta del catálogo. Baseline del admin + pipeline inbox equipo / gaps. |
| 2026-09-06 | Brief `planes-accion/CONTEXTO-BACKEND-INBOX-EQUIPO.md` para plan espejo en gesty-backend (WA-07…WA-11 sin cambio de estado). |
