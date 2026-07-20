const scaleOptions = Object.freeze([
  { id: "1", label: "1 · Not yet" , score: 1 },
  { id: "2", label: "2", score: 2 },
  { id: "3", label: "3 · Somewhat", score: 3 },
  { id: "4", label: "4", score: 4 },
  { id: "5", label: "5 · Confident", score: 5 },
].map(Object.freeze));

const questions = Object.freeze([
  ...pairedScale({
    id: "adapt-runtime",
    prompt: "I could adapt this presentation runtime for my own event.",
    purpose: "Measure whether the starter becomes more approachable after someone explores it.",
  }),
  ...pairedScale({
    id: "run-live-room",
    prompt: "I could run a live presentation while staying focused on the room.",
    purpose: "Measure confidence in the manual-first presenter workflow before and after the demo.",
  }),
]);

export const audienceConfig = Object.freeze({
  deckId: "starter-deck",
  privacyThreshold: 3,
  pollIntervalMs: 3000,
  participantPath: "/participate.html",
  aggregatePath: "/api/audience/aggregates",
  questions,
});

function pairedScale({ id, prompt, purpose }) {
  return ["entrance", "exit"].map((phase) => Object.freeze({
    id: `${phase}-${id}`,
    phase,
    pairId: id,
    prompt,
    type: "single",
    required: true,
    purpose,
    visibility: "public-aggregate",
    options: scaleOptions,
  }));
}

export function questionsForPhase(phase) {
  return audienceConfig.questions.filter((question) => question.phase === phase);
}

export function questionById(questionId) {
  return audienceConfig.questions.find((question) => question.id === questionId) || null;
}
