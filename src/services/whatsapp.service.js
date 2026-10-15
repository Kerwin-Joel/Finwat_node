import axios from "axios";

const GRAPH_URL = "https://graph.facebook.com/v22.0";

// Los BSUID de Meta tienen formato "PE.1409371164137441"; los teléfonos son solo dígitos
const isBsuid = (id) => typeof id === "string" && id.includes(".");

const postMessage = async (to, payload) => {
  const url = `${GRAPH_URL}/${process.env.PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      // Usuarios con username de WhatsApp: Meta oculta el teléfono y se responde por BSUID
      ...(isBsuid(to) ? { recipient: to } : { to }),
      ...payload,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};

export const sendWhatsAppMessage = async ({ to, text }) =>
  postMessage(to, { type: "text", text: { body: text } });

// Botón nativo de WhatsApp para que el usuario comparta su número con el negocio
export const sendContactInfoRequest = async ({ to, text }) =>
  postMessage(to, {
    type: "interactive",
    interactive: {
      type: "request_contact_info",
      body: { text },
      action: { name: "request_contact_info" },
    },
  });
