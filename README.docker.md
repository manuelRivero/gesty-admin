# Despliegue con Docker en DonWeb (Cloud Server)

App **gesty-admin** (Next.js 16) dockerizada con build `standalone` y reverse proxy **Nginx Proxy Manager** (HTTPS vía panel en el puerto 81).

## Requisitos en el VPS

- Docker Engine + plugin `docker compose`
- Puertos **80**, **443** y **81** abiertos en el firewall (81 = panel de NPM)
- Un dominio con registro **A** apuntando al IP del servidor

### Instalar Docker (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # reloguear después de esto
```

## Despliegue (build en el servidor)

```bash
# 1. Clonar el repo
git clone <URL_DEL_REPO> gesty-admin && cd gesty-admin

# 2. Crear el .env a partir del ejemplo y completar valores
cp .env.example .env
nano .env

# 3. Levantar (build + run + nginx)
docker compose up -d --build

# 4. Ver logs
docker compose logs -f app
```

### Configurar Nginx Proxy Manager

1. Abrí `http://TU_IP:81` e iniciá sesión (por defecto `admin@example.com` / `changeme`).
2. **Hosts → Proxy Hosts → Add Proxy Host**
3. **Domain Names:** valor de `DOMAIN` en tu `.env` (ej. `admin.tu-dominio.com`)
4. **Forward Hostname / IP:** `gesty-admin` (nombre del contenedor) o `app` (nombre del servicio)
5. **Forward Port:** `3000`
6. Activá **Block Common Exploits** y **Websockets Support** si usás sockets.
7. En la pestaña **SSL**, solicitá un certificado Let's Encrypt.

Luego abrí `https://TU_DOMINIO`.

## Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `DOMAIN` | Dominio público (referencia para configurar el proxy en NPM) |
| `NEXT_PUBLIC_API` | URL de la API. **Se incrusta en el build** del cliente |
| `NEXT_PUBLIC_SOCKET_URL` | URL del socket |
| `API` | URL de la API usada en SSR (servidor) |
| `DOCKER_IMAGE` | Imagen en el registro (solo despliegue con `docker-compose.prod.yml`) |

> ⚠️ Las variables `NEXT_PUBLIC_*` se "queman" durante el build. Si cambian, hay que reconstruir:
> `docker compose up -d --build`

## Actualizar a una nueva versión

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## Comandos útiles

```bash
docker compose ps             # estado
docker compose logs -f        # logs en vivo
docker compose down           # detener
docker compose restart app    # reiniciar solo la app
```

## Despliegue con imagen preconstruida (sin subir código)

Subís la imagen a un registro (Docker Hub o `ghcr.io`) y en el VPS solo hacés `docker pull` + `docker compose`.

### 1. En tu PC — build, tag y push

```bash
cd /ruta/al/proyecto
cp .env.example .env
nano .env
```

Variables del `.env` y cuándo se usan:

| Variable | Cuándo |
|---|---|
| `DOMAIN` | Referencia para configurar el proxy en NPM |
| `NEXT_PUBLIC_API` | **Build** — se incrusta en el cliente |
| `NEXT_PUBLIC_SOCKET_URL` | **Build** — se incrusta en el cliente |
| `API` | Runtime en el contenedor (SSR) |
| `DOCKER_IMAGE` | Nombre completo de la imagen en el registro |

```bash
set -a
source .env
set +a

docker build \
  --build-arg NEXT_PUBLIC_API="${NEXT_PUBLIC_API}" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL}" \
  -t gesty-admin:latest .

docker tag gesty-admin:latest "${DOCKER_IMAGE}"
docker login
docker push "${DOCKER_IMAGE}"
```

O con el script del repo:

```bash
./build-push.sh
```

### 2. En el VPS — solo imagen

Copiá al servidor únicamente estos archivos (no hace falta el código):

- `docker-compose.prod.yml`
- `.env`

```bash
scp docker-compose.prod.yml .env root@TU_IP:/opt/apps/gesty-admin/
```

En el servidor, el `.env` debe tener al menos:

```env
DOMAIN=admin.tu-dominio.com
API=https://api.tu-dominio.com
DOCKER_IMAGE=tuusuario/gesty-admin:latest
```

```bash
ssh root@TU_IP
cd /opt/apps/gesty-admin
docker login
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
```

En NPM, creá el proxy host apuntando a:

- **Forward Hostname / IP:** `gesty-admin` (misma red Docker) o `127.0.0.1` si NPM corre en el host
- **Forward Port:** `3000`
- **Domain Names:** el valor de `DOMAIN`

### 3. Actualizar versión

```bash
# PC: rebuild con las mismas variables NEXT_PUBLIC_* del .env
set -a && source .env && set +a
docker build \
  --build-arg NEXT_PUBLIC_API="${NEXT_PUBLIC_API}" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL}" \
  -t gesty-admin:latest .
docker tag gesty-admin:latest "${DOCKER_IMAGE}"
docker push "${DOCKER_IMAGE}"

# VPS
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

> Si cambiás `NEXT_PUBLIC_API` o `NEXT_PUBLIC_SOCKET_URL`, tenés que **reconstruir y volver a pushear** la imagen.
