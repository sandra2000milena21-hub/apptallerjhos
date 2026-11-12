"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type DailyAssistantBubble from "@/components/DailyAssistantBubble";

// El asistente (voz, sonidos, panel de misiones) pesa bastante: se descarga aparte,
// después de que el tablero ya está en pantalla y se puede usar.
const Assistant = dynamic(() => import("@/components/DailyAssistantBubble"), { ssr: false });

export default function AssistantLazy(props: ComponentProps<typeof DailyAssistantBubble>) {
  return <Assistant {...props} />;
}
