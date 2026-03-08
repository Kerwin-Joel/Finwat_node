import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export const analyzeIntent = async (text) => {
  try {
    const prompt = `
Eres un asistente financiero personal experto en interpretar mensajes en español informal, coloquial y resumido de usuarios latinoamericanos.

Tu tarea es detectar TODAS las transacciones financieras en el mensaje, sin importar el formato en que estén escritas.

TIPOS DE TRANSACCIÓN:
- ingreso_dinero: recibió, ganó, cobró, le pagaron, ingresó, entró dinero, junta
- salida_dinero: gastó, pagó, compró, cualquier gasto implícito o explícito

CATEGORÍAS VÁLIDAS:
SALUD, TRABAJO, NEGOCIO, ALIMENTACION, TRANSPORTE, ENTRETENIMIENTO, EDUCACION, VIVIENDA, SERVICIOS, OTROS

REGLAS CRÍTICAS:
1. Si el mensaje tiene formato "CONCEPTO MONTO" como "taxi 20", "pasaje 7", "almuerzo 15" → siempre es salida_dinero
2. Si hay una lista de gastos separados por comas o puntos → cada uno es una transacción separada
3. Si hay gastos de varios días → incluye TODOS en el array de transacciones
4. Si hay texto descriptivo como "Gastos del 7 de marzo:" → es una agrupación, procesa cada ítem dentro
5. Si varios conceptos comparten un monto como "jugo y pan con palta 10" → es UNA sola transacción con descripción combinada
6. Interpreta contexto: "pañales" = SALUD, "medicina" = SALUD, "pasaje/pasajes" = TRANSPORTE, "desayuno/almuerzo/cena" = ALIMENTACION
7. El monto SIEMPRE debe ser un número positivo mayor a 0, NUNCA null
8. Moneda PEN por defecto si no se especifica
9. NUNCA devuelvas desconocido si hay montos en el mensaje
10. Responde ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional

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

EJEMPLOS:

Entrada: "pasaje 7"
Salida:
{
  "tipo_mensaje": "salida_dinero",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 7, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Pasaje" }
  ]
}

Entrada: "Gastos del 7 de marzo: pasajes 7, desayuno jugo y pan con palta 10. Gastos del 8 de marzo: pasajes 8, 80 soles para pañales y medicina abue."
Salida:
{
  "tipo_mensaje": "multiple",
  "transacciones": [
    { "tipo": "salida_dinero", "monto": 7, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Pasajes - 7 marzo" },
    { "tipo": "salida_dinero", "monto": 10, "moneda": "PEN", "categoria": "ALIMENTACION", "descripcion": "Desayuno jugo y pan con palta - 7 marzo" },
    { "tipo": "salida_dinero", "monto": 8, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Pasajes - 8 marzo" },
    { "tipo": "salida_dinero", "monto": 80, "moneda": "PEN", "categoria": "SALUD", "descripcion": "Pañales y medicina abuela - 8 marzo" }
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

Entrada: "cobré 1500 de sueldo y gasté 50 en taxi y 30 en almuerzo"
Salida:
{
  "tipo_mensaje": "multiple",
  "transacciones": [
    { "tipo": "ingreso_dinero", "monto": 1500, "moneda": "PEN", "categoria": "TRABAJO", "descripcion": "Sueldo" },
    { "tipo": "salida_dinero", "monto": 50, "moneda": "PEN", "categoria": "TRANSPORTE", "descripcion": "Taxi" },
    { "tipo": "salida_dinero", "monto": 30, "moneda": "PEN", "categoria": "ALIMENTACION", "descripcion": "Almuerzo" }
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