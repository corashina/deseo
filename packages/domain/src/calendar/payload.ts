import type { EventInput } from './types';

export function eventPayload(input: EventInput) {
  return { id: input.id, pair_id: input.pairId, title: input.title, who: input.who,
    location: input.location || null, description: input.description || null,
    repeat: input.repeat ?? 'none', important_date: input.importantDate === true || input.repeat === 'yearly',
    confirm_shared: input.confirmShared === true,
    starts_at: input.temporal.kind === 'timed' ? input.temporal.startsAt : null,
    ends_at: input.temporal.kind === 'timed' ? input.temporal.endsAt : null,
    start_date: input.temporal.kind === 'allDay' ? input.temporal.startDate : null,
    end_date_exclusive: input.temporal.kind === 'allDay' ? input.temporal.endDateExclusive : null,
  };
}
