import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export const analyzeIntent = async (text) => {
  try {
    const prompt = `
Eres un analista financiero que procesa mensajes en español informal.
Tu tarea es detectar UNA o MÚLTIPLES transacciones financieras en el mensaje.

Tipos de transacción:
- ingreso_dinero: recibió, ganó, cobró, le pagaron
- salida_dinero: gastó, pagó, compró, perdió
- consulta_balance: pregunta por saldo o balance
- desconocido: no encaja en ninguna categoría financiera

Categorías válidas: SALUD, TRABAJO, NEGOCIO, ALIMENTACION, TRANSPORTE, ENTRETENIMIENTO, EDUCACION, VIVIENDA, SERVICIOS, OTROS

Reglas:
- Detecta TODAS las transacciones mencionadas en el mensaje
- Si hay múltiples transacciones, inclúyelas todas en el array
- El monto siempre es positivo
- Moneda PEN por defecto si no se especifica
- Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional

Estructura del JSON:
{
  "tipo_mensaje": "<ingreso_dinero | salida_dinero | multiple | consulta_balance | desconocido>",
  "transacciones": [
    {
      "tipo": "<ingreso_dinero | salida_dinero>",
      "monto": <number>,
      "moneda": "<PEN | USD | EUR>",
      "categoria": "<categoria>",
      "descripcion": "<descripcion breve>"
    }
  ]
}

Ejemplos:

Entrada: "gasté 20 en taxi y recibí 500 de un cliente"
Salida:
{
  "tipo_mensaje": "multiple",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 20, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Gasto en taxi" },
    { "tipo": "ingreso_dinero", "monto": 500, "moneda": "PEN", "categoria": "NEGOCIO", "descripcion": "Pago de cliente" }
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

Mensaje: "${text}"
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