import { supabase } from './supabase.service.js';

// Buscar usuario por número de teléfono
export const findUserByPhone = async (phone) => {
  console.log('🔍 Buscando número:', phone);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active')
    .eq('phone', phone)
    .single();

  console.log('📦 Resultado:', data);
  console.log('❌ Error:', error);

  if (error) return null;
  return data;
};

// Buscar usuario por BSUID de WhatsApp (usuarios con username, sin teléfono en el webhook)
export const findUserByWhatsAppId = async (bsuid) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active')
    .eq('whatsapp_user_id', bsuid)
    .maybeSingle();

  if (error) {
    console.error('❌ Error buscando BSUID (¿existe profiles.whatsapp_user_id?):', error.message);
    return null;
  }
  return data;
};

// Guardar el BSUID en el perfil para reconocer al usuario aunque Meta oculte su teléfono
export const linkWhatsAppId = async (userId, bsuid) => {
  const { error } = await supabase
    .from('profiles')
    .update({ whatsapp_user_id: bsuid })
    .eq('id', userId);

  if (error) {
    console.error('❌ Error vinculando BSUID:', error.message);
    return false;
  }
  console.log(`🔗 BSUID ${bsuid} vinculado al perfil ${userId}`);
  return true;
};

// Obtener cuenta principal del usuario
export const getDefaultAccount = async (userId) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, balance')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (error) return null;
  return data;
};

// Guardar transacción desde WhatsApp
// export const saveTransaction = async ({ userId, accountId, transaction }) => {
//   const { data, error } = await supabase
//     .from('transactions')
//     .insert({
//       user_id: userId,
//       account_id: accountId,
//       type: transaction.tipo === 'ingreso_dinero' ? 'income' : 'expense',
//       amount: transaction.monto,
//       currency: transaction.moneda ?? 'PEN',
//       category: transaction.categoria?.toUpperCase() ?? 'OTROS',
//       description: transaction.descripcion,
//       transaction_date: transaction.fecha ?? new Date().toISOString().split('T')[0],
//       source: 'whatsapp',
//       status: 'completed',
//     })
//     .select()
//     .single();

//   if (error) throw error;

//   // ✅ Actualizar balance en accounts
//   const balanceChange = transaction.tipo === 'ingreso_dinero' ? transaction.monto : -transaction.monto;

//   const { error: balanceError } = await supabase.rpc('update_account_balance', {
//     p_account_id: accountId,
//     p_amount: balanceChange,
//   });

//   if (balanceError) throw balanceError;

//   return data;
// };

// Guardar transacción desde WhatsApp
export const saveTransaction = async ({ userId, accountId, transaction }) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountId,
      type: transaction.tipo === 'ingreso_dinero' ? 'income' : 'expense',
      amount: transaction.monto,
      currency: transaction.moneda ?? 'PEN',
      category: transaction.categoria?.toUpperCase() ?? 'OTROS',
      description: transaction.descripcion,
      transaction_date: transaction.fecha ?? new Date().toISOString().split('T')[0],
      source: 'whatsapp',
      status: 'completed',
    })
    .select()
    .single();

  if (error) throw error;

  // ✅ El trigger sync_account_balance actualiza automáticamente
  return data;
};