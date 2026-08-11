# PulpSense Funnel Lifecycle

This context defines the business language used to describe a prospect's progression through a PulpSense funnel and its follow-up communication.

## Language

**Lead Journey**:
One accepted funnel submission and its subsequent progression. A person may have multiple Lead Journeys, and each Lead Journey has its own Slack thread.
_Avoid_: Lead, Slack lead

**Lead Contact Details**:
The actionable identity and acquisition context shown to the sales team: full name, business email, phone number, company domain, funnel name, and available source, medium, and campaign attribution. Technical request, tracking, analytics, and authentication data are not Lead Contact Details.
_Avoid_: Raw lead payload, request data

**Communication Recipient**:
The lead identity used to coordinate Communication Flows, defined by one verified normalized email address. Matching names do not establish the same Communication Recipient; different email addresses remain separate recipients.
_Avoid_: Name match, inferred person

**Qualified but Unbooked**:
A Communication Recipient whose qualified application has been accepted and who has not completed a verified booking. The state begins when the application is accepted, not when calendar interaction is observed.
_Avoid_: Calendar viewer, abandoned booking

**Communication Flow**:
A defined series of lead communications that begins and ends in response to lifecycle changes. Its message count, channels, timing, cadence, and copy belong to the flow definition rather than the funnel lifecycle.
_Avoid_: Trigger workflow, email blast

**Pre-call Nurture**:
A Trigger.dev-owned Communication Flow that confirms, educates, and prepares a Communication Recipient while a Sales Appointment remains scheduled. Trigger.dev owns selection, cadence, waits, idempotency, rescheduling, and cancellation; Brevo's Transactional Email API delivers each message when Trigger.dev requests it.
_Avoid_: Meeting reminder, confirmation email

**Booking Confirmation**:
The first Pre-call Nurture message, requested immediately by Trigger.dev and delivered through Brevo seconds after a verified booking.
_Avoid_: Meeting reminder, Gmail confirmation

**Booking Link**:
A personalized Cal.com URL issued to an eligible Communication Recipient, with contact fields prefilled and signed funnel context carried into the resulting booking. The current Booking Link is stored in Brevo for use by Communication Flows.
_Avoid_: Resume page, generic calendar link

**Ads Booking Calendar**:
The Cal.com event type reserved exclusively for appointments originating from paid-ad funnels. It is not shared with other scheduling purposes.
_Avoid_: General calendar, personal booking link

**Meeting Reminder**:
An appointment-relative transactional message whose only purpose is to remind the recipient about an active, upcoming Sales Appointment. It is not a Communication Flow and must be recalculated on reschedule or suppressed on cancellation.
_Avoid_: Pre-call nurture, nurture email

**Sales Handoff**:
The transfer of communication responsibility from acquisition nurturing to the sales process when a verified booking is completed. A later cancellation remains sales-owned and does not restore the Qualified but Unbooked state.
_Avoid_: Nurture completion, booked email

**Sales Appointment**:
The booked call created by a Sales Handoff. Rescheduling changes its scheduled time but does not create a new Lead Journey, reverse the handoff, or return the recipient to acquisition nurturing.
_Avoid_: New lead after reschedule, replacement journey
