import { Router } from "express";
import {
  verifyWebhook,
  receiveWebhook
} from "../controllers/webhook.controller.js";
import { analyzeIntent } from "../services/ai.service.js";
import { saveMessage } from "../storage/local.storage.js";

// remover webhook, esto no me sirve, pero primero hay que leerl
// para poder eliminar este archivo y tomar referencia para el archivo whataap.route

const router = Router();

// Meta verifica con GET
router.get("/", verifyWebhook);

// Meta envía eventos con POST
router.post("/", receiveWebhook);

router.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const text = message.text?.body;
    const from = message.from;

    console.log("📩 Mensaje:", text);

    // 1️⃣ Analizar intención con Gemini
    const { intent } = await analyzeIntent(text);

    console.log("🧠 Intención detectada:", intent);

    // 2️⃣ Guardar en local
    saveMessage({
      from,
      text,
      intent,
      date: new Date().toISOString(),
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error webhook:", err);
    res.sendStatus(500);
  }
});
export default router;
