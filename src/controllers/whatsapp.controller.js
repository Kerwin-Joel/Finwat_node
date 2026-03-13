import { sendWhatsAppMessage } from '../services/whatsapp.service.js';
import { analyzeIntent } from '../services/ai.service.js';
import { findUserByPhone, getDefaultAccount, saveTransaction } from '../services/user.service.js';
import { checkRateLimit } from '../services/ratelimit.service.js';
import { confirmReminderByWhatsApp } from '../services/reminder.service.js';
import { getPendingRemindersByUser, confirmReminderById } from '../services/reminder.service.js';

const processedMessages = new Set();
const reminderSessions = new Map()

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
    if ( !message || message.type !== 'text' ) return;
    
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
    if (!text) return;

    console.log(`📩 De: ${from} | Mensaje: ${text}`);

    // 1️⃣ Anti-spam
    const rateLimit = checkRateLimit(from);
    if (!rateLimit.allowed) {
      await sendWhatsAppMessage({
        to: from,
        text: '⏳ Estás enviando demasiados mensajes. Espera un momento e intenta de nuevo.',
      });
      return;
    }

    // 2️⃣ Verificar usuario registrado
    const user = await findUserByPhone(from);
    if (!user) {
      await sendWhatsAppMessage({
        to: from,
        text: '👋 Hola! No estás registrado en Finwat.\n\nRegístrate en nuestra app para empezar a gestionar tus finanzas por WhatsApp 📱\n\nhttps://finwat.app',
      });
      return;
    }

    if (!user.is_active) {
      await sendWhatsAppMessage({
        to: from,
        text: '⚠️ Tu cuenta está desactivada. Contacta soporte para más información.',
      });
      return;
    }

    // 3️⃣ Obtener cuenta principal
    const account = await getDefaultAccount( user.id );
    
    if (!account) {
      await sendWhatsAppMessage({
        to: from,
        text: '⚠️ No tienes una cuenta configurada. Ingresa a la app y crea tu cuenta principal.',
      });
      return;
    }

    // ✅  Detección manual de comandos
    const nombre = user.full_name?.split(' ')[0] ?? 'amigo';
    const textLower = text.toLowerCase();
    const esConsultaBalance = ['balance', 'saldo', 'cuanto tengo', 'cuánto tengo', 'mi saldo', 'mi balance'].some(cmd => textLower.includes(cmd));

    if (esConsultaBalance) {
      const emoji = account.balance >= 0 ? '📈' : '📉';
      await sendWhatsAppMessage({
        to: from,
        text: `${emoji} *Balance de ${nombre}*\n\n💼 Cuenta: ${account.name}\n💵 S/. ${account.balance.toFixed(2)}\n\n_Actualizado al ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}_`,
      });
      return;
    }
    const esConfirmacion = ['listo', 'hecho', 'ok', 'pagado', 'completado', 'listo!', 'hecho!'].some(cmd => textLower === cmd || textLower.startsWith(cmd));

    // Verificar si el usuario está esperando seleccionar un recordatorio
if (reminderSessions.has(from)) {
    const pending = reminderSessions.get(from);
    const num = parseInt(textLower.trim());

    if (!isNaN(num) && num >= 1 && num <= pending.length) {
        const selected = pending[num - 1];
        const success = await confirmReminderById(selected.id);
        reminderSessions.delete(from);

        await sendWhatsAppMessage({
            to: from,
            text: success
                ? `✅ *¡Listo ${nombre}!*\n\n"${selected.title}" marcado como completado 🎉`
                : `❌ Hubo un error al confirmar. Intenta desde la app.`,
        });
        return;
    } else {
        // Respuesta inválida, mostrar lista de nuevo
        const lista = pending.map((r, i) => {
            const fecha = new Date(r.due_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
            const monto = r.amount ? ` — S/. ${Number(r.amount).toFixed(2)}` : '';
            return `${i + 1}. ${r.title}${monto} (${fecha})`;
        }).join('\n');

        await sendWhatsAppMessage({
            to: from,
            text: `Por favor responde con un número del 1 al ${pending.length}:\n\n${lista}`,
        });
        return;
    }
}

// Confirmación inicial
if (esConfirmacion) {
    const pending = await getPendingRemindersByUser(user.id);

    if (pending.length === 0) {
        await sendWhatsAppMessage({
            to: from,
            text: `👍 No tienes recordatorios pendientes ${nombre}.`,
        });
        return;
    }

    if (pending.length === 1) {
        // Solo uno → confirmar directo
        const success = await confirmReminderById(pending[0].id);
        await sendWhatsAppMessage({
            to: from,
            text: success
                ? `✅ *¡Listo ${nombre}!*\n\n"${pending[0].title}" marcado como completado 🎉`
                : `❌ Hubo un error al confirmar. Intenta desde la app.`,
        });
        return;
    }

    // Varios → preguntar cuál
    reminderSessions.set(from, pending);

    // Limpiar sesión después de 5 minutos
    setTimeout(() => reminderSessions.delete(from), 5 * 60 * 1000);

    const lista = pending.map((r, i) => {
        const fecha = new Date(r.due_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
        const monto = r.amount ? ` — S/. ${Number(r.amount).toFixed(2)}` : '';
        return `${i + 1}. ${r.title}${monto} (${fecha})`;
    }).join('\n');

    await sendWhatsAppMessage({
        to: from,
        text: `🔔 Tienes ${pending.length} recordatorios pendientes ${nombre}.\n\n¿Cuál quieres marcar como completado?\n\n${lista}\n\nResponde con el número.`,
    });
    return;
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
      return;
    }

    if (intent.tipo_mensaje === 'desconocido') {
      await sendWhatsAppMessage({
        to: from,
        text: '🤔 No entendí bien tu mensaje. Puedes decirme algo como:\n\n• "Gasté 50 en almuerzo"\n• "Recibí 200 de un cliente"\n• "¿Cuál es mi balance?"',
      });
      return;
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
      return;
    }

    const resumen = resultados.map(tx => {
      const emoji = tx.type === 'income' ? '💰' : '💸';
      return `${emoji} ${tx.description} — S/. ${tx.amount.toFixed(2)}`;
    }).join('\n');

    await sendWhatsAppMessage({
      to: from,
      text: `✅ Registrado exitosamente:\n\n${resumen}\n\n_Escribe "balance" para ver tu saldo_`,
    });

    return;
  } catch (err) {
    console.error('❌ Error:', err);
  }
};
