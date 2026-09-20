export default function ShoppingIndexPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Elegí un local</h1>
      <p className="text-muted-foreground text-sm">
        Abrí el link con el slug del negocio, por ejemplo{" "}
        <code className="text-foreground text-xs">/shopping/tu-local</code>.
      </p>
    </div>
  )
}
