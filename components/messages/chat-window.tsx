"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Loader2, ShoppingCart } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { MessageBubble, type Message } from "./message-bubble"
import { MessageInput } from "./message-input"
import { ConversationSentimentBanner } from "./conversation-sentiment-banner"
import { DraftOrderModal } from "./draft-order-modal"
import type { ChatItemData } from "./chat-item"

interface ChatWindowProps {
  chat: ChatItemData
  messages: Message[]
  onSendMessage: (message: string) => void
  botEnabled: boolean
  isTogglingBot?: boolean
  isSendingMessage?: boolean
  onToggleBot: (enabled: boolean) => void
}

export function ChatWindow({
  chat,
  messages,
  onSendMessage,
  botEnabled,
  isTogglingBot = false,
  isSendingMessage = false,
  onToggleBot,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentiment = chat.aiSentiment ?? null
  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-10">
              {chat.avatar ? (
                <AvatarImage src={chat.avatar} alt={chat.customerName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary">
                {chat.customerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {chat.isOnline && (
              <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-green-500" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">{chat.customerName}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={botEnabled ? "default" : "secondary"}>
            {botEnabled ? "Bot activo" : "Modo humano"}
          </Badge>
          {isTogglingBot ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Guardando...
            </span>
          ) : null}
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <Bot className="size-4 text-muted-foreground" />
            <Switch
              checked={botEnabled}
              onCheckedChange={onToggleBot}
              disabled={isTogglingBot}
              aria-label="Alternar bot de conversación"
            />
          </div>
          {!botEnabled ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="size-4" />
              Ver carrito
            </Button>
          ) : null}
        </div>
      </div>

      {!botEnabled ? (
        <DraftOrderModal
          open={isCartOpen}
          onOpenChange={setIsCartOpen}
          conversationId={chat.id}
          customerName={chat.customerName}
        />
      ) : null}

      {sentiment ? (
        <ConversationSentimentBanner
          sentiment={sentiment}
          summary={chat.aiSentimentSummary}
        />
      ) : null}

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-scroll bg-muted/30 p-4"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="flex min-h-full flex-col gap-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Message Input */}
      {!botEnabled ? (
        <MessageInput
          onSendMessage={onSendMessage}
          disabled={isSendingMessage}
        />
      ) : null}
    </div>
  )
}
