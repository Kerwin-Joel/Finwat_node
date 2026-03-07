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
      transaction_date: new Date().toISOString().split('T')[0],
      source: 'whatsapp',
      status: 'completed',
    })
    .select()
    .single();

  if (error) throw error;

  // ✅ Actualizar balance en accounts
  const balanceChange = transaction.tipo === 'ingreso_dinero' ? transaction.monto : -transaction.monto;

  const { error: balanceError } = await supabase.rpc('update_account_balance', {
    p_account_id: accountId,
    p_amount: balanceChange,
  });

  if (balanceError) throw balanceError;

  return data;
};