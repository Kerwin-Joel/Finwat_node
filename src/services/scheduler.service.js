import cron from 'node-cron';
import { getPendingRemindersToNotify, markReminderNotified } from './reminder.service.js';
import { sendWhatsAppMessage } from './whatsapp.service.js';

const buildReminderMessage = (reminder) => {
    const nombre = reminder.profiles?.full_name?.split(' ')[0] ?? 'amigo';
    const typeEmoji = {
        debt:        '💸',
        service:     '⚡',
        free:        '🔔',
        credit_card: '💳',
    }[reminder.type] ?? '🔔';

    const dueDate = new Date(reminder.due_date);
    const dateStr = dueDate.toLocaleDateString('es-PE', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    const advanceText = reminder.notify_advance === 0
        ? '📅 *Vence hoy*'
        : `📅 Vence el *${dateStr}*`;

    const amountText = reminder.amount
        ? `\n💵 Monto: *S/. ${Number(reminder.amount).toFixed(2)}*`
        : '';

    const recurrenceText = reminder.recurrence !== 'none'
        ? `\n🔁 Recurrencia: ${
            { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' }[reminder.recurrence]
          }`
        : '';

    return `${typeEmoji} *Recordatorio Finwat*\n\n` +
           `Hola ${nombre}! Tienes un recordatorio pendiente:\n\n` +
           `📌 *${reminder.title}*\n` +
           `${advanceText}${amountText}${recurrenceText}\n\n` +
           `${reminder.notes ? `📝 ${reminder.notes}\n\n` : ''}` +
           `Responde *"listo"* o *"hecho"* para confirmar que lo completaste ✅`;
};

export const startScheduler = () => {
    // Corre cada hora en punto
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Scheduler: verificando recordatorios...');
        try {
            const reminders = await getPendingRemindersToNotify();
            console.log(`📋 Recordatorios a notificar: ${reminders.length}`);

            for (const reminder of reminders) {
                const phone = reminder.profiles?.phone;
                if (!phone) continue;

                try {
                    await sendWhatsAppMessage({
                        to: phone,
                        text: buildReminderMessage(reminder),
                    });
                    console.log(`✅ Notificado: ${reminder.title} → ${phone}`);
                } catch (err) {
                    console.error(`❌ Error enviando a ${phone}:`, err.message);
                }
            }
        } catch (err) {
            console.error('❌ Error en scheduler:', err);
        }
    });

    console.log('✅ Scheduler iniciado — verificando recordatorios cada hora');
};