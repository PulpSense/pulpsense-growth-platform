# Keep appointment-relative communication orchestration in Trigger.dev

Trigger.dev owns durable funnel lifecycle state and every appointment-relative pre-call decision: message selection, count, timing, waits, idempotency, cancellation, rescheduling, and send eligibility. Brevo's Transactional Email API is the delivery transport for those sends; canonical copy and rendering remain versioned in this repository. Brevo Automations continue to own evergreen newsletter, welcome, and lead-magnet programs whose timing is not anchored to an active appointment.
