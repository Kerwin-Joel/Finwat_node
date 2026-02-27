import { analyzeIntent } from "../services/ai.service.js";
import { saveMessage } from "../services/storage.service.js";

export const verifyWebhook = ( req, res ) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
console.log("TOKEN ENV:", process.env.VERIFY_TOKEN);
console.log("TOKEN META:", req.query["hub.verify_token"]);

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verificado por Meta");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

export const receiveMessage = async (req, res) => {
  console.log("🟡 Webhook recibido");

  const message =
    req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message?.text?.body) {
    return res.sendStatus(200);
  }

  const text = message.text.body;
  const from = message.from;

  console.log("📩 Mensaje:", text);

  const intent = await analyzeIntent(text);

  saveMessage({
    from,
    text,
    intent: intent.intent,
  });

  console.log("💾 Guardado correctamente");

  res.sendStatus(200);
};

console.log("🟡 Webhook recibido");
console.log("🟡 BODY:", JSON.stringify(req.body, null, 2));
