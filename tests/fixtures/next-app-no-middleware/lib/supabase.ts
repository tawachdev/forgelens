export function getServiceRole() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}
