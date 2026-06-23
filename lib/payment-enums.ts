// Canonical Postgres payment enum values (mirror migration 0001). The manual-entry
// route validates against the MANUAL_* subsets. Unit tests guard against the enum
// regressions that broke manual payment recording (e.g. 'matched',
// 'sponsorship_credit', 'corporate_match' are all INVALID).
export const PAYMENT_TYPES = ['registration_fee', 'iq_team_fee', 'fundraising', 'sponsorship', 'in_kind', 'unknown'] as const
export const PAYMENT_SOURCES = ['zeffy', 'check', 'benevity', 'corporate_platform', 'cash', 'manual_adjustment', 'other'] as const
export const MATCHED_STATUSES = ['unmatched', 'auto_matched', 'manually_matched', 'ignored', 'needs_review'] as const

// What the admin manual-entry form/route accepts (a subset of the canonical enums).
export const MANUAL_PAYMENT_TYPES = ['registration_fee', 'fundraising', 'iq_team_fee', 'sponsorship']
export const MANUAL_PAYMENT_SOURCES = ['check', 'cash', 'benevity', 'corporate_platform', 'other']
