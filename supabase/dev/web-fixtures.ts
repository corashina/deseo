export const ANNA_EMAIL = 'anna@deseo.example.test';
export const MAREK_EMAIL = 'marek@deseo.example.test';
const fixtureUuid = (n: number) => `d3500000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const FIXED_IDS = {
  annaId: fixtureUuid(1), marekId: fixtureUuid(2), sharedEventId: fixtureUuid(10), privateEventId: fixtureUuid(11),
  walkEventId: fixtureUuid(12), annaEventId: fixtureUuid(13), marekEventId: fixtureUuid(14), breakEventId: fixtureUuid(15), importantEventId: fixtureUuid(16),
  ideaId: fixtureUuid(20), secondIdeaId: fixtureUuid(21), taskId: fixtureUuid(30), unassignedTaskId: fixtureUuid(31), completedTaskId: fixtureUuid(32), dueTaskId: fixtureUuid(33),
  annaMessageClientId: fixtureUuid(40), marekMessageClientId: fixtureUuid(41), memoryId: fixtureUuid(50), secondMemoryId: fixtureUuid(51), photoId: fixtureUuid(52), secondPhotoId: fixtureUuid(53),
  createPairCommandId: fixtureUuid(100), inviteCommandId: fixtureUuid(101), acceptCommandId: fixtureUuid(102), groceriesCommandId: fixtureUuid(1103),
};
export type FixtureIds = {
  annaId: string; marekId: string; pairId: string; sharedEventId: string; privateEventId: string; ideaId: string;
  generalListId: string; groceriesListId: string; taskId: string; annaMessageId: string; marekMessageId: string; memoryId: string;
  walkEventId: string; annaEventId: string; marekEventId: string; breakEventId: string; importantEventId: string;
  secondIdeaId: string; unassignedTaskId: string; completedTaskId: string; dueTaskId: string; secondMemoryId: string;
};

export const fixtureContentCommandId = (n: number) => fixtureUuid(1000 + n);
