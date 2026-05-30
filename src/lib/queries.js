import { supabase } from './supabase'

// All reads are public (RLS allows select for everyone).

// Every milestone, with its figure and location joined, oldest first.
// Drives the Timeline; the By Field and Map views filter the same shape.
export async function getMilestones() {
  const { data, error } = await supabase
    .from('stp_milestones')
    .select('*, figure:stp_figures(*), location:stp_locations(*)')
    .order('year', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getMilestonesByField(field) {
  const { data, error } = await supabase
    .from('stp_milestones')
    .select('*, figure:stp_figures(*), location:stp_locations(*)')
    .eq('field', field)
    .order('year', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getMilestoneById(id) {
  const { data, error } = await supabase
    .from('stp_milestones')
    .select('*, figure:stp_figures(*), location:stp_locations(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// For the World Map: locations with the milestones that happened there,
// each joined to the figure behind it.
export async function getLocations() {
  const { data, error } = await supabase
    .from('stp_locations')
    .select('*, milestones:stp_milestones(*, figure:stp_figures(*))')
    .order('city', { ascending: true })
  if (error) throw error
  return data ?? []
}
