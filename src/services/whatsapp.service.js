import axios from "axios";

const GRAPH_URL = "https://graph.facebook.com/v22.0";

export const sendWhatsAppMessage = async ({ to, text }) => {
  const url = `${GRAPH_URL}/${process.env.PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};
