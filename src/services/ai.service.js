import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export const analyzeIntent = async (text) => {
  try {
    const prompt = `
Eres un asistente financiero personal que interpreta mensajes en español informal, coloquial y resumido de usuarios peruanos.

Tu tarea es detectar UNA o MÚLTIPLES transacciones financieras en el mensaje, incluso cuando el usuario escribe de forma muy resumida.

TIPOS DE TRANSACCIÓN:
- ingreso_dinero: recibió, ganó, cobró, le pagaron, ingresó, entró dinero
- salida_dinero: gastó, pagó, compró, perdió, salió dinero, cualquier gasto implícito
- consulta_balance: pregunta por saldo, balance, cuánto tiene
- desconocido: no tiene ninguna relación con dinero o finanzas

CATEGORÍAS VÁLIDAS:
SALUD, TRABAJO, NEGOCIO, ALIMENTACION, TRANSPORTE, ENTRETENIMIENTO, EDUCACION, VIVIENDA, SERVICIOS, OTROS

REGLAS IMPORTANTES:
- Si el mensaje es solo "CONCEPTO MONTO" como "taxi 20", "almuerzo 15", "pasaje 7" → es siempre salida_dinero
- Si el mensaje es "cobré X", "me pagaron X", "entró X", "junta X", "ingresó X" → es ingreso_dinero
- Interpreta abreviaciones peruanas: "pje" = pasaje, "almu" = almuerzo, "cena" = cena, "desa" = desayuno
- Si solo hay un número y una palabra, asume que es un gasto del concepto mencionado
- Detecta TODAS las transacciones mencionadas en el mensaje
- El monto siempre es positivo
- Moneda PEN por defecto si no se especifica USD, EUR, etc.
- NUNCA respondas "desconocido" si hay un número y una palabra en el mensaje
- Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional

EJEMPLOS DE MENSAJES RESUMIDOS:
- "pasaje 7" → gasto de 7 soles en transporte
- "taxi 15" → gasto de 15 soles en transporte  
- "almuerzo 12" → gasto de 12 soles en alimentación
- "luz 80" → gasto de 80 soles en servicios
- "junta 200" → ingreso de 200 soles
- "cobré 500" → ingreso de 500 soles
- "desa 8 y almuerzo 15" → dos gastos en alimentación
- "me pagaron 1000 y gasté 50 en taxi" → ingreso + gasto

ESTRUCTURA DEL JSON:
{
  "tipo_mensaje": "<ingreso_dinero | salida_dinero | multiple | consulta_balance | desconocido>",
  "transacciones": [
    {
      "tipo": "<ingreso_dinero | salida_dinero>",
      "monto": <number>,
      "moneda": "<PEN | USD | EUR>",
      "categoria": "<categoria>",
      "descripcion": "<descripcion clara y breve>"
    }
  ]
}

EJEMPLOS COMPLETOS:

Entrada: "pasaje 7"
Salida:
{
  "tipo_mensaje": "salida_dinero",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 7, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Pasaje" }
  ]
}

Entrada: "gasté 20 en taxi y recibí 500 de un cliente"
Salida:
{
  "tipo_mensaje": "multiple",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 20, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Gasto en taxi" },
    { "tipo": "ingreso_dinero", "monto": 500, "moneda": "PEN", "categoria": "NEGOCIO", "descripcion": "Pago de cliente" }
  ]
}

Entrada: "almuerzo 12 taxi 8 agua 2"
Salida:
{
  "tipo_mensaje": "multiple",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 12, "moneda": "PEN", "categoria": "ALIMENTACION", "descripcion": "Almuerzo" },
    { "tipo": "salida_dinero", "monto": 8, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Taxi" },
    { "tipo": "salida_dinero", "monto": 2, "moneda": "PEN", "categoria": "ALIMENTACION", "descripcion": "Agua" }
  ]
}

Entrada: "pagué 50 soles de luz"
Salida:
{
  "tipo_mensaje": "salida_dinero",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 50, "moneda": "PEN", "categoria": "SERVICIOS", "descripcion": "Pago de luz" }
  ]
}

Mensaje del usuario: "${text}"
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const raw = response.text;

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { intent: "unknown" };

    return JSON.parse(match[0]);

  } catch (err) {
    console.error("❌ Gemini error:", err.message);
    return { intent: err.message };
  }
};