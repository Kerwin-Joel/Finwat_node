import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export const getPendingRemindersToNotify = async () => {
    const now = new Date();
    const results = [];

    const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*, profiles(phone, full_name)')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

    if (error) {
        console.error('❌ Error fetching reminders:', error);
        return [];
    }

    for (const reminder of reminders) {
        const todayUTC = now.toISOString().split('T')[0];

        // Calcular fecha de notificación
        const dueDate = new Date(reminder.due_date + 'T00:00:00Z');
        const notifyDate = new Date(dueDate);
        notifyDate.setUTCDate(notifyDate.getUTCDate() - reminder.notify_advance);
        const notifyStr = notifyDate.toISOString().split('T')[0];

        if (notifyStr !== todayUTC) continue;

        if (reminder.due_time) {
            // Con hora: verificar ventana de ±30 min en UTC
            const [hh, mm] = reminder.due_time.split(':').map(Number);
            const notifyHour = new Date();
            notifyHour.setUTCHours(hh, mm, 0, 0);
            const diffMs = Math.abs(now - notifyHour);

            console.log(`⏰ due_time=${reminder.due_time} | nowUTC=${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2,'0')} | diffMs=${diffMs}ms | pass=${diffMs <= 30 * 60 * 1000}`);

            if (diffMs > 30 * 60 * 1000) continue;

            // Ya fue notificado hoy?
            if (reminder.last_notified_at) {
                const lastStr = new Date(reminder.last_notified_at).toISOString().split('T')[0];
                if (lastStr === todayUTC) continue;
            }
        } else {
            // Sin hora: notificar solo entre 08:00-08:05 UTC
            const utcHour = now.getUTCHours();
            const utcMin = now.getUTCMinutes();
            if (!(utcHour === 8 && utcMin < 5)) continue;

            // Ya fue notificado hoy?
            if (reminder.last_notified_at) {
                const lastStr = new Date(reminder.last_notified_at).toISOString().split('T')[0];
                if (lastStr === todayUTC) continue;
            }
        }

        results.push(reminder);
    }

    return results;
};

export const markReminderNotified = async (id) => {
    const { data: reminder } = await supabase
        .from('reminders')
        .select('recurrence, due_date')
        .eq('id', id)
        .single();

    if (!reminder) return;

    if (reminder.recurrence === 'none') {
        await supabase
            .from('reminders')
            .update({
                status: 'completed',
                last_notified_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        return;
    }

    // Calcular próxima fecha para recurrentes
    const next = new Date(reminder.due_date + 'T00:00:00Z');
    if (reminder.recurrence === 'daily')   next.setUTCDate(next.getUTCDate() + 1);
    if (reminder.recurrence === 'weekly')  next.setUTCDate(next.getUTCDate() + 7);
    if (reminder.recurrence === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);

    await supabase
        .from('reminders')
        .update({
            due_date: next.toISOString().split('T')[0],
            last_notified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id);
};

export const getPendingRemindersByUser = async (userId) => {
    const { data, error } = await supabase
        .from('reminders')
        .select('id, title, due_date, amount')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

    if (error || !data) return [];
    return data;
};

export const confirmReminderById = async (id) => {
    const { error } = await supabase
        .from('reminders')
        .update({
            status: 'completed',
            whatsapp_confirmed: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    return !error;
};

export const confirmReminderByWhatsApp = async (userId) => {
    console.log('🔍 Buscando reminder pendiente para userId:', userId);

    const { data, error: fetchError } = await supabase
        .from('reminders')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1)
        .single();

    console.log('🔍 Resultado:', data, 'Error:', fetchError);
    if (!data) return null;

    const { error: updateError } = await supabase
        .from('reminders')
        .update({
            status: 'completed',
            whatsapp_confirmed: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', data.id);

    console.log('✅ Update error:', updateError);
    return data.id;
};