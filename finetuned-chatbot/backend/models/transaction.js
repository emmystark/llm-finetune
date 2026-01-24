async function addTransaction(userId, data) {
  const { error } = await supabase.from('transactions').insert({ user_id: userId, ...data });
  if (error) throw error;
}
// Export getTransactions, etc.