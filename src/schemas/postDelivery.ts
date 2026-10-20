// Validate intent only: Ghost owns active newsletter, recipient/filter validity,
// timing and state transitions. Never infer recipients or retry a send here.
export function validatePostDeliveryInput(input: Record<string, unknown>): void {
    const publishing = input.status === 'published' || input.status === 'scheduled';
    if (input.email_segment !== undefined && input.newsletter === undefined) {
        throw new Error('email_segment requires an explicit newsletter slug.');
    }
    if (input.newsletter !== undefined && !publishing) {
        throw new Error('Newsletter delivery requires explicit status published or scheduled.');
    }
    if (input.newsletter !== undefined && input.status === 'scheduled' && typeof input.published_at !== 'string') {
        throw new Error('Scheduled newsletter delivery requires an explicit published_at date-time.');
    }
    if (input.email_only === true && publishing && input.newsletter === undefined) {
        throw new Error('Email-only publishing or scheduling requires a newsletter; create a draft first.');
    }
}
