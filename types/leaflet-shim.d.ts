/** Stub mínimo: el proyecto usa Leaflet sin @types/leaflet (leaflet-draw no tipado). */
declare module "leaflet" {
  const L: any
  export default L
}

declare module "leaflet-draw"
