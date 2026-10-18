"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { isAxiosError } from "axios"
import { Eye, EyeOff } from "lucide-react"

import { getUserRoleFromToken, resolveAccessToken, setAuthCookie } from "@/lib/auth"
import { resolvePostLoginDestination } from "@/lib/access-control"
import { login } from "@/lib/requests/login"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const loginSchema = z.object({
  email: z.string().email("Introduce un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
})

type LoginFormValues = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null)
    try {
      const data = await login(values)
      const token = resolveAccessToken(data)
      if (!token) {
        setSubmitError("El servidor no devolvió un token de acceso.")
        return
      }
      setAuthCookie(token)
      const role = getUserRoleFromToken(token)
      const from =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("from")
          : null
      const dest = resolvePostLoginDestination(role, from)
      router.push(dest)
      router.refresh()
    } catch (err) {
      if (isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ??
          err.response?.statusText
        setSubmitError(
          typeof msg === "string" && msg
            ? msg
            : "No se pudo iniciar sesión. Revisa credenciales o la URL del API.",
        )
        return
      }
      setSubmitError("Error inesperado. Inténtalo de nuevo.")
    }
  }

  function submitWithFallbackValues() {
    const email = emailInputRef.current?.value?.trim() ?? ""
    const password = passwordInputRef.current?.value ?? ""
    if (!email || !password) {
      setSubmitError("Completa correo y contraseña para continuar.")
      return
    }
    void onSubmit({ email, password })
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center overflow-hidden rounded-xl">
          <Image src="/gesty-face.png" alt="Gesty" width={48} height={48} className="size-12 object-cover" />
        </div>
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription>
          Accede al panel de administración con tu cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => {
                const { ref, ...fieldProps } = field
                return (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="tu@empresa.com"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void form.handleSubmit(onSubmit, submitWithFallbackValues)()
                          }
                        }}
                        {...fieldProps}
                        ref={(element) => {
                          ref(element)
                          emailInputRef.current = element
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => {
                const { ref, ...fieldProps } = field
                return (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className="pr-10"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              void form.handleSubmit(onSubmit, submitWithFallbackValues)()
                            }
                          }}
                          {...fieldProps}
                          ref={(element) => {
                            ref(element)
                            passwordInputRef.current = element
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
                          aria-label={
                            showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                          }
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            {submitError ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={form.formState.isSubmitting}
              onClick={() => {
                void form.handleSubmit(onSubmit, submitWithFallbackValues)()
              }}
              onTouchEnd={() => {
                void form.handleSubmit(onSubmit, submitWithFallbackValues)()
              }}
            >
              {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return <LoginForm />
}
