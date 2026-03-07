import { sendWhatsAppMessage } from '../services/whatsapp.service.js';
import { analyzeIntent } from '../services/ai.service.js';
import { findUserByPhone, getDefaultAccount, saveTransaction } from '../services/user.service.js';
import { checkRateLimit } from '../services/ratelimit.service.js';

const processedMessages = new Set();

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const receiveMessage = async ( req, res ) => {
  // ✅ Responder 200 inmediatamente para evitar reintentos de Meta
  res.sendStatus(200);
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if ( !message || message.type !== 'text' ) return res.sendStatus( 200 );
    
    const messageId = message.id;

    // ✅ Si ya procesamos este mensaje, ignorarlo
    if (processedMessages.has(messageId)) {
      console.log(`⚠️ Mensaje duplicado ignorado: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);

    // Limpiar mensajes viejos cada 1000 para no llenar memoria
    if (processedMessages.size > 1000) processedMessages.clear();

    const from = message.from;
    const text = message.text?.body?.trim();
    if (!text) return res.sendStatus(200);

    console.log(`📩 De: ${from} | Mensaje: ${text}`);

    // 1️⃣ Anti-spam
    const rateLimit = checkRateLimit(from);
    if (!rateLimit.allowed) {
      await sendWhatsAppMessage({
        to: from,
        text: '⏳ Estás enviando demasiados mensajes. Espera un momento e intenta de nuevo.',
      });
      return res.sendStatus(200);
    }

    // 2️⃣ Verificar usuario registrado
    const user = await findUserByPhone(from);
    if (!user) {
      await sendWhatsAppMessage({
        to: from,
        text: '👋 Hola! No estás registrado en Finwat.\n\nRegístrate en nuestra app para empezar a gestionar tus finanzas por WhatsApp 📱\n\nhttps://finwat.app',
      });
      return res.sendStatus(200);
    }

    if (!user.is_active) {
      await sendWhatsAppMessage({
        to: from,
        text: '⚠️ Tu cuenta está desactivada. Contacta soporte para más información.',
      });
      return res.sendStatus(200);
    }

    // 3️⃣ Obtener cuenta principal
    const account = await getDefaultAccount( user.id );
    
    if (!account) {
      await sendWhatsAppMessage({
        to: from,
        text: '⚠️ No tienes una cuenta configurada. Ingresa a la app y crea tu cuenta principal.',
      });
      return res.sendStatus(200);
    }

    // 4️⃣ Respuesta inmediata mientras procesa
    await sendWhatsAppMessage({
      to: from,
      text: '⏳ Analizando tu mensaje...',
    });


    // 4️⃣ Analizar mensaje con Gemini
    const intent = await analyzeIntent(text);
    console.log('🤖 Gemini:', JSON.stringify(intent));

    // 5️⃣ Procesar según intent
    if (intent.tipo_mensaje === 'consulta_balance') {
      await sendWhatsAppMessage({
        to: from,
        text: `📊 Tu balance actual es S/. ${account.balance.toFixed(2)}`,
      });
      return res.sendStatus(200);
    }

    if (intent.tipo_mensaje === 'desconocido') {
      await sendWhatsAppMessage({
        to: from,
        text: '🤔 No entendí bien tu mensaje. Puedes decirme algo como:\n\n• "Gasté 50 en almuerzo"\n• "Recibí 200 de un cliente"\n• "¿Cuál es mi balance?"',
      });
      return res.sendStatus(200);
    }

    // 6️⃣ Guardar transacciones
    const transacciones = intent.transacciones ?? [];
    const resultados = [];

    for (const tx of transacciones) {
      if (!tx.monto || tx.monto <= 0) continue;
      const saved = await saveTransaction({
        userId: user.id,
        accountId: account.id,
        transaction: tx,
      });
      resultados.push(saved);
    }

    // 7️⃣ Responder con resumen
    if (resultados.length === 0) {
      await sendWhatsAppMessage({
        to: from,
        text: '⚠️ No pude registrar la transacción. Intenta con un mensaje más claro.',
      });
      return res.sendStatus(200);
    }

    const resumen = resultados.map(tx => {
      const emoji = tx.type === 'income' ? '💰' : '💸';
      return `${emoji} ${tx.description} — S/. ${tx.amount.toFixed(2)}`;
    }).join('\n');

    await sendWhatsAppMessage({
      to: from,
      text: `✅ Registrado exitosamente:\n\n${resumen}\n\n_Escribe "balance" para ver tu saldo_`,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error:', err);
    return res.sendStatus(500);
  }
};

export const sendMessage = async (req, res) => {
  res.json({ ok: true, message: 'sendMessage pendiente' });
};