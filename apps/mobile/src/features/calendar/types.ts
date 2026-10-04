export type Owner = 'a' | 'b' | 'together';
export type Visibility = 'shared' | 'private';
export type EventTime =
  | { kind: 'timed'; startsAt: string; endsAt: string }
  | { kind: 'allDay'; startDate: string; endDateExclusive: string };

export type EventInput = {
  id: string;
  pairId: string;
  title: string;
  owner: Owner;
  visibility: Visibility;
  timezone: string;
  temporal: EventTime;
  location?: string;
  description?: string;
  confirmShared?: boolean;
};
export type Event = Omit<EventInput, 'confirmShared'> & { authorId: string; version: number };
export type AgendaItem = Event;
export type AgendaRange = { pairId: string; from: string; to: string };
export type EventFormValues = {
  title: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startOffset?: number;
  endOffset?: number;
  timezone: string;
  owner: Owner;
  visibility: Visibility;
  location: string;
  description: string;
};
