"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SettingsSectionProps {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
}

export function SettingsSection({
  id,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col [&>*+*]:mt-6 [&>*+*]:border-t [&>*+*]:border-border/45 [&>*+*]:pt-6">
        {children}
      </CardContent>
    </Card>
  )
}
