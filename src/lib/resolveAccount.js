/**
 * Resolve account_id e role a partir de user_id consultando o Supabase da aplicação.
 * Usado quando o JWT não traz account_id (ex.: Supabase Auth sem custom claims).
 * Espelha a lógica da Edge Function get-access-state: has_role + get_user_scd_id / get_user_affiliate_id.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Cliente Supabase da app (service_role)
 * @param {string} userId - UUID do usuário (JWT sub)
 * @returns {Promise<{ accountId: string | null, role: string }>}
 */
export async function resolveAccountFromUser(supabase, userId) {
  if (!userId) {
    return { accountId: null, role: 'consumer' };
  }

  const [adminRes, scdRes, affiliateRes] = await Promise.all([
    supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
    supabase.rpc('has_role', { _user_id: userId, _role: 'scd_user' }),
    supabase.rpc('has_role', { _user_id: userId, _role: 'affiliate' }),
  ]);

  const isAdmin = adminRes.data === true;
  const isScdUser = scdRes.data === true;
  const isAffiliate = affiliateRes.data === true;

  if (isAdmin) {
    return { accountId: null, role: 'admin' };
  }

  if (isScdUser) {
    const { data: scdId, error } = await supabase.rpc('get_user_scd_id', { _user_id: userId });
    if (!error && scdId) {
      return { accountId: scdId, role: 'scd_user' };
    }
    return { accountId: null, role: 'scd_user' };
  }

  if (isAffiliate) {
    const { data: affiliateId, error } = await supabase.rpc('get_user_affiliate_id', { _user_id: userId });
    if (!error && affiliateId) {
      return { accountId: affiliateId, role: 'affiliate' };
    }
    return { accountId: null, role: 'affiliate' };
  }

  return { accountId: null, role: 'consumer' };
}
