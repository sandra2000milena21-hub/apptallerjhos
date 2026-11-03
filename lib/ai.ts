import { getSettings } from "./db";
import { DEVICE_TYPES } from "./constants";

export type IntakeGuess = {
  device_type: string;
  brand: string;
  model: string;
  color: string;
  capacity: string;
  services: string[];
  problem: string;
  priority: "normal" | "alta" | "urgente";
  source: "ia" | "reglas";
};

const RULES: { re: RegExp; type?: string; service?: string }[] = [
  { re: /\b(iphone|celular|cel|samsung galaxy s|galaxy a|redmi|motorola|moto g)\b/i, type: "celular" },
  { re: /\b(ipad|tablet|tab s|galaxy tab)\b/i, type: "tablet" },
  { re: /\b(macbook|portátil|portatil|laptop|computador|pc|imac|thinkpad|vivobook|ideapad)\b/i, type: "computador" },
  { re: /\b(ps5|ps4|playstation|xbox|switch|consola|steam deck|dualsense|control)\b/i, type: "consola" },
  { re: /\b(watch|reloj)\b/i, type: "reloj" },
  { re: /(pantalla|display|vidrio|táctil|tactil|lcd|líneas|lineas)/i, service: "pantalla" },
  { re: /(bater[ií]a|se descarga|hinchad|inflad)/i, service: "bateria" },
  { re: /(no carga|carga|pin de carga|puerto de carga)/i, service: "carga" },
  { re: /(no prende|no enciende|apagado|muerto)/i, service: "no_enciende" },
  { re: /(mojad|agua|piscina|líquido|liquido|derram)/i, service: "mojado" },
  { re: /(tapa trasera|carcasa|vidrio trasero)/i, service: "carcasa" },
  { re: /(hdmi)/i, service: "hdmi" },
  { re: /(no da video|sin video|no da imagen)/i, service: "no_video" },
  { re: /(drift|palanca|joystick)/i, service: "drift" },
  { re: /(calienta|ruido|ventilador|mantenimiento|limpieza)/i, service: "temperatura" },
  { re: /(teclado|trackpad)/i, service: "teclado" },
  { re: /(lento|formate|sistema operativo|windows|virus)/i, service: "software" },
  { re: /(cámara|camara)/i, service: "camara" },
];

// Nombres cortos que la gente usa en el mostrador → modelo del catálogo.
const ALIASES: [RegExp, string, string][] = [
  [/\bps5\s*pro\b/i, "PlayStation 5 Pro", "Sony"],
  [/\bps5\s*slim\b/i, "PlayStation 5 Slim", "Sony"],
  [/\b(ps5|play\s*5|playstation\s*5)\b/i, "PlayStation 5", "Sony"],
  [/\b(ps4\s*pro)\b/i, "PlayStation 4 Pro", "Sony"],
  [/\b(ps4|play\s*4|playstation\s*4)\b/i, "PlayStation 4", "Sony"],
  [/\bseries\s*x\b/i, "Xbox Series X", "Microsoft"],
  [/\bseries\s*s\b/i, "Xbox Series S", "Microsoft"],
  [/\bswitch\s*2\b/i, "Nintendo Switch 2", "Nintendo"],
  [/\bswitch\s*oled\b/i, "Nintendo Switch OLED", "Nintendo"],
  [/\bswitch\b/i, "Nintendo Switch", "Nintendo"],
  [/\bdualsense\b/i, "Control DualSense", "Sony"],
  [/\bsteam\s*deck\b/i, "Steam Deck", "Valve"],
];

function ruleGuess(text: string): IntakeGuess {
  let type = "celular";
  const services: string[] = [];
  for (const r of RULES) {
    if (r.type && r.re.test(text)) {
      type = r.type;
      break;
    }
  }
  const dt = DEVICE_TYPES.find((d) => d.key === type)!;
  for (const r of RULES) if (r.service && r.re.test(text) && dt.services.some((s) => s.key === r.service)) services.push(r.service);
  if (type === "computador" && /lento|mantenimiento|limpieza/i.test(text)) services.push("mantenimiento");
  const alias = ALIASES.find(([re]) => re.test(text));
  let model = dt.models.filter((m) => text.toLowerCase().includes(m.toLowerCase())).sort((a, b) => b.length - a.length)[0] ?? "";
  if (!model && alias) model = alias[1];
  if (!model) {
    // "iphone 13 pro max" escrito en minúsculas o sin el modelo exacto: toma la marca/línea y los números que siguen.
    const m = /\b(iphone|ipad|macbook\s*(air|pro)?|galaxy\s*\w+|redmi\s*note\s*\d+|apple\s*watch)\s*([\w\s]{0,12}?\d+\s*(pro\s*max|pro|plus|mini|max|ultra)?)?/i.exec(text);
    if (m) model = m[0].trim().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Iphone/, "iPhone").replace(/^Ipad/, "iPad").replace(/^Macbook/, "MacBook");
  }
  const capacity = /(\d{2,4})\s?(gb|tb)/i.exec(text)?.[0]?.toUpperCase().replace(/\s?/, " ") ?? "";
  const brand = dt.brands.find((b) => text.toLowerCase().includes(b.toLowerCase())) ?? (/(iphone|ipad|macbook|imac|watch)/i.test(text) ? "Apple" : alias?.[2] ?? "");
  return {
    device_type: type,
    brand,
    model,
    color: "",
    capacity,
    services: Array.from(new Set(services)),
    problem: text.trim(),
    priority: services.includes("mojado") ? "alta" : "normal",
    source: "reglas",
  };
}

/** Convierte una frase ("iPhone 13 se mojó y no carga") en los datos de la orden. Usa IA si hay clave; si no, reglas. */
export async function guessIntake(text: string): Promise<IntakeGuess> {
  const s = await getSettings();
  const key = process.env.ANTHROPIC_API_KEY || s.ai_key;
  if (!key) return ruleGuess(text);
  const types = DEVICE_TYPES.map((d) => `${d.key}: servicios [${d.services.map((x) => x.key).join(", ")}]`).join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: s.ai_model || "claude-haiku-5-5",
        max_tokens: 400,
        system:
          "Eres el asistente de recepción de un taller de reparación en Colombia. Extrae los datos de la orden de la frase del asesor. Responde SOLO con JSON válido con las claves: device_type, brand, model, color, capacity, services (lista de claves), problem (la falla redactada claro, en español, en palabras del cliente), priority (normal|alta|urgente; los equipos mojados son alta). Usa solo estos tipos y servicios:\n" +
          types,
        messages: [{ role: "user", content: text }],
      }),
    });
    const data = await res.json();
    const raw = (data?.content?.[0]?.text as string) || "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const dt = DEVICE_TYPES.find((d) => d.key === json.device_type) ?? DEVICE_TYPES[0];
    return {
      device_type: dt.key,
      brand: String(json.brand || ""),
      model: String(json.model || ""),
      color: String(json.color || ""),
      capacity: String(json.capacity || ""),
      services: (Array.isArray(json.services) ? json.services : []).filter((k: string) => dt.services.some((s) => s.key === k)),
      problem: String(json.problem || text),
      priority: ["normal", "alta", "urgente"].includes(json.priority) ? json.priority : "normal",
      source: "ia",
    };
  } catch {
    return ruleGuess(text);
  }
}
