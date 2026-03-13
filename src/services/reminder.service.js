import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: {
            schema: 'public'
        },
        global: {
            headers: {
                'x-supabase-auth-bypass-rls': 'true'
            }
        }
    }
);

export const getPendingRemindersToNotify = async () => {
    const today = new Date();
    const results = [];

    // Traer todos los recordatorios pendientes
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
        const dueDate = new Date(reminder.due_date);
        const notifyDate = new Date(dueDate);
        notifyDate.setDate(notifyDate.getDate() - reminder.notify_advance);

        // Normalizar a medianoche para comparar solo fechas
        const todayStr = today.toISOString().split('T')[0];
        const notifyStr = notifyDate.toISOString().split('T')[0];

        if (notifyStr !== todayStr) continue;

        // Si tiene hora específica, verificar que sea la hora actual (±5 min)
        if (reminder.due_time) {
            const [hh, mm] = reminder.due_time.split(':').map(Number);
            
            // Usar hora UTC del servidor para comparar
            const nowUTC = new Date();
            const notifyHour = new Date();
            const offset = parseInt(process.env.TIMEZONE_OFFSET ?? '-5');
            notifyHour.setUTCHours(hh - offset, mm, 0, 0);
            
            const diffMs = Math.abs(nowUTC - notifyHour);
            console.log(`⏰ due_time=${reminder.due_time} | nowUTC=${nowUTC.getUTCHours()}:${nowUTC.getUTCMinutes()} | diffMs=${diffMs}ms | pass=${diffMs <= 30 * 60 * 1000}`);
            
            if (diffMs > 30 * 60 * 1000) continue;
        }

        results.push(reminder);
    }

    return results;
};

export const markReminderNotified = async (id) => {
    // Si no es recurrente, lo completamos
    // Si es recurrente, avanzamos la fecha al siguiente ciclo
    const { data: reminder } = await supabase
        .from('reminders')
        .select('recurrence, due_date')
        .eq('id', id)
        .single();

    if (!reminder) return;

    if (reminder.recurrence === 'none') {
        await supabase
            .from('reminders')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', id);
        return;
    }

    // Calcular próxima fecha
    const next = new Date(reminder.due_date);
    if (reminder.recurrence === 'daily')   next.setDate(next.getDate() + 1);
    if (reminder.recurrence === 'weekly')  next.setDate(next.getDate() + 7);
    if (reminder.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);

    await supabase
        .from('reminders')
        .update({
            due_date: next.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        })
        .eq('id', id);
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