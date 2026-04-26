// Central source of truth for intervention types, metric defaults, and seed data.
//
// NOTE: metrics are now user-specific — they come out of the goals AI step and
// live in app state alongside goals. This file only defines the *palette* of
// colors/icons we fall back to when the AI response is missing those fields,
// and the legacy seed data used by the dev "Seed sample data" button.

export const INTERVENTION_TYPES = [
  { key: 'supplement', label: 'Supplement', icon: '💊', secondField: 'dose',     secondPlaceholder: '400mg'  },
  { key: 'medication', label: 'Medication', icon: '💉', secondField: 'dose',     secondPlaceholder: '10mg'   },
  { key: 'habit',      label: 'Habit',      icon: '🔄', secondField: null,       secondPlaceholder: null     },
  { key: 'exercise',   label: 'Exercise',   icon: '🏃', secondField: 'duration', secondPlaceholder: '30 min' },
  { key: 'therapy',    label: 'Therapy',    icon: '🧠', secondField: null,       secondPlaceholder: null     },
  { key: 'diet',       label: 'Diet',       icon: '🥬', secondField: null,       secondPlaceholder: null     },
  { key: 'device',     label: 'Device',     icon: '⌚', secondField: 'duration', secondPlaceholder: '15 min' },
  { key: 'other',      label: 'Other',      icon: '✦',  secondField: 'details',  secondPlaceholder: ''       },
]

export const TYPE_BY_KEY = Object.fromEntries(INTERVENTION_TYPES.map(t => [t.key, t]))

export const iconForType = (type) => TYPE_BY_KEY[type]?.icon ?? '✦'

// Palette used to assign colors to AI-generated metrics when the model omits a
// color. Ordered so the first few are the historically-tested ones, with
// additional hues appended for users with larger metric sets.
export const METRIC_PALETTE = [
  '#00A699', // teal — classic "calm"
  '#FC642D', // orange — energy
  '#5B8DEF', // blue — focus
  '#914669', // mulberry — sleep
  '#FF5A5F', // rose — mood
  '#9E6B52', // clay — accent match
  '#7B8B5E', // olive
  '#4B6477', // slate
]

export function colorFromPalette(index) {
  return METRIC_PALETTE[index % METRIC_PALETTE.length]
}

// ---------- Date helpers ----------
export function formatDateFull(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------- Seed data ----------
// Used when the user taps "Seed sample data" in Insights → Dev tools.
// Demonstrates the new goal/metric shape.
export const SEED_METRICS = [
  { id: 'seed-m-anx',    name: 'anxiety',       label: 'Anxiety', type: 'scale',    direction: 'down', low: 'anxious',  high: 'calm',      icon: '🌊', color: '#00A699' },
  { id: 'seed-m-energy', name: 'energy',        label: 'Energy',  type: 'scale',    direction: 'up',   low: 'drained',  high: 'energized', icon: '⚡', color: '#FC642D' },
  { id: 'seed-m-focus',  name: 'focus',         label: 'Focus',   type: 'scale',    direction: 'up',   low: 'scattered', high: 'locked in', icon: '🎯', color: '#5B8DEF' },
  { id: 'seed-m-sleep',  name: 'sleep quality', label: 'Sleep',   type: 'scale',    direction: 'up',   low: 'terrible', high: 'amazing',   icon: '🌙', color: '#914669' },
  { id: 'seed-m-bf',     name: 'body fat',      label: 'Body fat', type: 'periodic', direction: 'down', unit: '%',       cadence: 'monthly', icon: '⚖️', color: '#9E6B52' },
]

export const SEED_GOALS = [
  { id: 'seed-g-1', name: 'reduce anxiety', metricId: 'seed-m-anx',    priority: 1, tracked: true },
  { id: 'seed-g-2', name: 'more energy',    metricId: 'seed-m-energy', priority: 2, tracked: true },
  { id: 'seed-g-3', name: 'improve focus',  metricId: 'seed-m-focus',  priority: 3, tracked: true },
  { id: 'seed-g-4', name: 'better sleep',   metricId: 'seed-m-sleep',  priority: 4, tracked: true },
]

export const SEED_INTERVENTIONS = [
  { id: 'seed-1', name: 'Magnesium Glycinate', type: 'supplement', dose: '400mg',   frequency: 'Daily', status: 'active',  startDate: '2026-03-01', endDate: null, notes: 'before bed' },
  { id: 'seed-2', name: 'Vitamin D3 + K2',     type: 'supplement', dose: '4000 IU', frequency: 'Daily', status: 'active',  startDate: '2026-02-15', endDate: null, notes: null          },
  { id: 'seed-3', name: 'Fish Oil',            type: 'supplement', dose: '1300mg EPA', frequency: 'Daily', status: 'active', startDate: '2026-02-15', endDate: null, notes: null         },
  { id: 'seed-4', name: 'Creatine',            type: 'supplement', dose: '5g',      frequency: 'Daily', status: 'active',  startDate: '2026-01-10', endDate: null, notes: null          },
  { id: 'seed-5', name: 'L-Theanine',          type: 'supplement', dose: '200mg',   frequency: 'Daily', status: 'active',  startDate: '2026-03-05', endDate: null, notes: 'with coffee' },
  { id: 'seed-6', name: 'Trintellix',          type: 'medication', dose: '10mg',    frequency: 'Daily', status: 'active',  startDate: '2025-09-08', endDate: null, notes: 'for anxiety' },
  { id: 'seed-7', name: 'Morning run',         type: 'exercise',   dose: '20 min',  frequency: 'Daily', status: 'active',  startDate: '2026-03-20', endDate: null, notes: null          },
  { id: 'seed-8', name: 'Melatonin',           type: 'supplement', dose: '300mcg',  frequency: 'Occasional', status: 'active', startDate: '2026-03-01', endDate: null, notes: 'on rough nights' },
]
