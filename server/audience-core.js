import { audienceConfig, questionsForPhase } from "../shared/audience-config.js";

export const MAX_JSON_BYTES = 8 * 1024;
export const PHASES = Object.freeze(["entrance", "exit"]);

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ATTENDEE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class AudienceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AudienceError";
    this.status = status;
    this.code = code;
  }
}

export function createAudienceService({
  db,
  repository = db ? createD1AudienceRepository(db) : null,
  eventId = audienceConfig.deckId,
  privacyThreshold = audienceConfig.privacyThreshold,
  now = () => Date.now(),
  randomUUID = () => crypto.randomUUID(),
  randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length)),
} = {}) {
  if (!repository) throw new Error("An audience repository or D1 binding is required.");
  if (!eventId || typeof eventId !== "string") throw new Error("eventId must be a non-empty string.");
  if (!Number.isInteger(privacyThreshold) || privacyThreshold < 3) {
    throw new Error("privacyThreshold must be an integer of at least 3.");
  }

  async function createSession(payload) {
    assertExactObject(payload, [], []);
    const attendeeId = randomUUID();
    assertAttendeeId(attendeeId);
    const recoveryCode = generateRecoveryCode(randomBytes);
    const recoveryHash = await hashRecoveryCode(eventId, recoveryCode);
    await repository.createAttendee({ eventId, attendeeId, recoveryHash, createdAt: now() });
    return {
      attendeeId,
      recoveryCode,
      completed: { entrance: false, exit: false },
    };
  }

  async function recoverSession(payload) {
    assertExactObject(payload, ["recoveryCode"], ["recoveryCode"]);
    const normalized = normalizeRecoveryCode(payload.recoveryCode);
    if (!isRecoveryCode(normalized)) throw recoveryFailure();
    const recoveryHash = await hashRecoveryCode(eventId, normalized);
    const attendee = await repository.findAttendeeByRecoveryHash({ eventId, recoveryHash });
    if (!attendee) throw recoveryFailure();
    const completed = await completedPhases(repository, eventId, attendee.attendeeId);
    return { attendeeId: attendee.attendeeId, completed };
  }

  async function replacePhaseResponse(phase, payload) {
    assertPhase(phase);
    assertExactObject(payload, ["attendeeId", "answers"], ["attendeeId", "answers"]);
    assertAttendeeId(payload.attendeeId);
    const answers = validateAnswers(phase, payload.answers);
    const exists = await repository.attendeeExists({ eventId, attendeeId: payload.attendeeId });
    if (!exists) throw new AudienceError(404, "attendee_not_found", "The attendee session could not be found.");
    const responseHash = await sha256Hex(JSON.stringify(answers));
    const existing = await repository.getPhaseResponseHash({ eventId, attendeeId: payload.attendeeId, phase });
    if (existing && existing !== responseHash) throw responseConflict();
    const storedHash = await repository.replacePhaseResponse({
      eventId,
      attendeeId: payload.attendeeId,
      phase,
      submittedAt: now(),
      responseHash,
      answers,
    });
    if (storedHash !== responseHash) throw responseConflict();
    const completed = await completedPhases(repository, eventId, payload.attendeeId);
    return { attendeeId: payload.attendeeId, phase, completed };
  }

  async function getAggregates() {
    const sections = {};
    for (const phase of PHASES) {
      const hiddenTotal = await repository.countPhaseRespondents({ eventId, phase });
      const publishedRespondents = releasedCount(hiddenTotal, privacyThreshold);
      sections[phase] = publishedRespondents === 0
        ? suppressedSection("questions")
        : {
            suppressed: false,
            publishedRespondents,
            questions: buildQuestionAggregates(
              phase,
              publishedRespondents,
              await repository.aggregatePhaseAnswers({ eventId, phase, limit: publishedRespondents }),
            ),
          };
    }

    const hiddenPairedTotal = await repository.countPairedRespondents({ eventId });
    const publishedPaired = releasedCount(hiddenPairedTotal, privacyThreshold);
    const paired = publishedPaired === 0
      ? suppressedSection("measures")
      : {
          suppressed: false,
          publishedRespondents: publishedPaired,
          measures: buildPairedMeasures(
            publishedPaired,
            await repository.aggregatePairedAnswers({ eventId, phase: "entrance", limit: publishedPaired }),
            await repository.aggregatePairedAnswers({ eventId, phase: "exit", limit: publishedPaired }),
          ),
        };

    const publicPayload = {
      ok: true,
      privacyThreshold,
      entrance: sections.entrance,
      exit: sections.exit,
      paired,
    };
    return {
      ok: true,
      version: `v1-${(await sha256Hex(JSON.stringify(publicPayload))).slice(0, 16)}`,
      privacyThreshold,
      entrance: sections.entrance,
      exit: sections.exit,
      paired,
    };
  }

  return Object.freeze({ createSession, recoverSession, replacePhaseResponse, getAggregates });
}

export function createD1AudienceRepository(db) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new Error("A D1-compatible database binding is required.");
  }

  return Object.freeze({
    async createAttendee({ eventId, attendeeId, recoveryHash, createdAt }) {
      await db.prepare(
        "INSERT INTO attendees (event_id, attendee_id, recovery_hash, created_at) VALUES (?1, ?2, ?3, ?4)",
      ).bind(eventId, attendeeId, recoveryHash, createdAt).run();
    },

    async findAttendeeByRecoveryHash({ eventId, recoveryHash }) {
      return db.prepare(
        "SELECT attendee_id AS attendeeId FROM attendees WHERE event_id = ?1 AND recovery_hash = ?2 LIMIT 1",
      ).bind(eventId, recoveryHash).first();
    },

    async attendeeExists({ eventId, attendeeId }) {
      const row = await db.prepare(
        "SELECT 1 AS found FROM attendees WHERE event_id = ?1 AND attendee_id = ?2 LIMIT 1",
      ).bind(eventId, attendeeId).first();
      return row?.found === 1;
    },

    async listCompletedPhases({ eventId, attendeeId }) {
      const result = await db.prepare(
        "SELECT phase FROM submissions WHERE event_id = ?1 AND attendee_id = ?2 ORDER BY phase",
      ).bind(eventId, attendeeId).all();
      return result.results || [];
    },

    async getPhaseResponseHash({ eventId, attendeeId, phase }) {
      const row = await db.prepare(
        "SELECT response_hash AS responseHash FROM submissions WHERE event_id = ?1 AND attendee_id = ?2 AND phase = ?3 LIMIT 1",
      ).bind(eventId, attendeeId, phase).first();
      return row?.responseHash || null;
    },

    async replacePhaseResponse({ eventId, attendeeId, phase, submittedAt, responseHash, answers }) {
      const statements = [
        db.prepare(
          `INSERT INTO submissions (event_id, attendee_id, phase, submitted_at, response_hash)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(event_id, attendee_id, phase) DO NOTHING`,
        ).bind(eventId, attendeeId, phase, submittedAt, responseHash),
        ...answers.flatMap(({ questionId, optionIds }) => optionIds.map((optionId) => db.prepare(
          `INSERT INTO answers (event_id, attendee_id, phase, question_id, option_id)
           SELECT ?1, ?2, ?3, ?4, ?5
           WHERE EXISTS (
             SELECT 1 FROM submissions
             WHERE event_id = ?1 AND attendee_id = ?2 AND phase = ?3 AND response_hash = ?6
           )
           ON CONFLICT(event_id, attendee_id, phase, question_id, option_id) DO NOTHING`,
        ).bind(eventId, attendeeId, phase, questionId, optionId, responseHash))),
      ];
      await db.batch(statements);
      const stored = await db.prepare(
        "SELECT response_hash AS responseHash FROM submissions WHERE event_id = ?1 AND attendee_id = ?2 AND phase = ?3 LIMIT 1",
      ).bind(eventId, attendeeId, phase).first();
      return stored?.responseHash || null;
    },

    async countPhaseRespondents({ eventId, phase }) {
      const row = await db.prepare(
        "SELECT COUNT(*) AS count FROM submissions WHERE event_id = ?1 AND phase = ?2",
      ).bind(eventId, phase).first();
      return Number(row?.count || 0);
    },

    async aggregatePhaseAnswers({ eventId, phase, limit }) {
      const result = await db.prepare(
        `WITH eligible AS (
           SELECT attendee_id
           FROM submissions
           WHERE event_id = ?1 AND phase = ?2
           ORDER BY submitted_at, attendee_id
           LIMIT ?3
         )
         SELECT answers.question_id AS questionId, answers.option_id AS optionId, COUNT(*) AS count
         FROM answers
         INNER JOIN eligible ON eligible.attendee_id = answers.attendee_id
         WHERE answers.event_id = ?1 AND answers.phase = ?2
         GROUP BY answers.question_id, answers.option_id
         ORDER BY answers.question_id, answers.option_id`,
      ).bind(eventId, phase, limit).all();
      return result.results || [];
    },

    async countPairedRespondents({ eventId }) {
      const row = await db.prepare(
        `SELECT COUNT(*) AS count FROM (
           SELECT attendee_id
           FROM submissions
           WHERE event_id = ?1
           GROUP BY attendee_id
           HAVING COUNT(DISTINCT phase) = 2
         )`,
      ).bind(eventId).first();
      return Number(row?.count || 0);
    },

    async aggregatePairedAnswers({ eventId, phase, limit }) {
      const result = await db.prepare(
        `WITH eligible AS (
           SELECT attendee_id, MAX(submitted_at) AS completed_at
           FROM submissions
           WHERE event_id = ?1
           GROUP BY attendee_id
           HAVING COUNT(DISTINCT phase) = 2
           ORDER BY completed_at, attendee_id
           LIMIT ?2
         )
         SELECT answers.question_id AS questionId, answers.option_id AS optionId, COUNT(*) AS count
         FROM answers
         INNER JOIN eligible ON eligible.attendee_id = answers.attendee_id
         WHERE answers.event_id = ?1 AND answers.phase = ?3
         GROUP BY answers.question_id, answers.option_id
         ORDER BY answers.question_id, answers.option_id`,
      ).bind(eventId, limit, phase).all();
      return result.results || [];
    },
  });
}

export async function readJsonBody(request, maxBytes = MAX_JSON_BYTES) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    throw new AudienceError(415, "unsupported_media_type", "Use application/json for this endpoint.");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw payloadTooLarge();

  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("request body too large");
      throw payloadTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder().decode(bytes);
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AudienceError(400, "invalid_json", "The request body must contain valid JSON.");
  }
}

export function generateRecoveryCode(randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))) {
  const bytes = randomBytes(20);
  if (!(bytes instanceof Uint8Array) || bytes.length < 20) throw new Error("randomBytes must return at least 20 bytes.");
  const raw = Array.from(bytes.slice(0, 20), (value) => CROCKFORD[value & 31]).join("");
  return raw.match(/.{5}/gu).join("-");
}

export function normalizeRecoveryCode(value) {
  return String(value || "").toUpperCase().replace(/[\s-]+/gu, "");
}

export async function hashRecoveryCode(eventId, code) {
  return sha256Hex(`${eventId}:${normalizeRecoveryCode(code)}`);
}

export function validateAnswers(phase, value) {
  assertPhase(phase);
  if (!isPlainObject(value)) throw validationError("answers must be a JSON object.");
  const questions = questionsForPhase(phase);
  const allowedIds = new Set(questions.map((question) => question.id));
  const submittedIds = Object.keys(value);
  const unknown = submittedIds.find((questionId) => !allowedIds.has(questionId));
  if (unknown) throw validationError(`Unknown question: ${unknown}.`);

  const normalized = [];
  for (const question of questions) {
    const selected = value[question.id];
    if (selected == null) {
      if (question.required) throw validationError(`Missing required question: ${question.id}.`);
      continue;
    }
    if (!Array.isArray(selected) || selected.some((optionId) => typeof optionId !== "string")) {
      throw validationError(`${question.id} must be an array of option IDs.`);
    }
    const unique = [...new Set(selected)].sort();
    const maxSelections = question.type === "single" ? 1 : Number(question.maxSelections || question.options.length);
    if (unique.length < (question.required ? 1 : 0) || unique.length > maxSelections) {
      throw validationError(`${question.id} has an invalid number of selections.`);
    }
    const allowedOptions = new Set(question.options.map((option) => option.id));
    const invalid = unique.find((optionId) => !allowedOptions.has(optionId));
    if (invalid) throw validationError(`Unknown option for ${question.id}: ${invalid}.`);
    normalized.push({ questionId: question.id, optionIds: unique });
  }
  return normalized;
}

function buildQuestionAggregates(phase, respondents, rows) {
  const counts = countMap(rows);
  return Object.fromEntries(questionsForPhase(phase).map((question) => [question.id, {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    purpose: question.purpose,
    options: optionAggregates(question, respondents, counts),
  }]));
}

function buildPairedMeasures(respondents, entranceRows, exitRows) {
  const entranceCounts = countMap(entranceRows);
  const exitCounts = countMap(exitRows);
  const entranceQuestions = questionsForPhase("entrance");
  const exitByPair = new Map(questionsForPhase("exit").map((question) => [question.pairId, question]));
  const measures = [];
  for (const entranceQuestion of entranceQuestions) {
    if (!entranceQuestion.pairId || !exitByPair.has(entranceQuestion.pairId)) continue;
    const exitQuestion = exitByPair.get(entranceQuestion.pairId);
    const entranceOptions = optionAggregates(entranceQuestion, respondents, entranceCounts);
    const exitOptions = optionAggregates(exitQuestion, respondents, exitCounts);
    const entranceMean = scoredMean(entranceQuestion, entranceOptions, respondents);
    const exitMean = scoredMean(exitQuestion, exitOptions, respondents);
    measures.push([entranceQuestion.pairId, {
      id: entranceQuestion.pairId,
      prompt: entranceQuestion.prompt,
      purpose: entranceQuestion.purpose,
      entrance: { questionId: entranceQuestion.id, mean: entranceMean, options: entranceOptions },
      exit: { questionId: exitQuestion.id, mean: exitMean, options: exitOptions },
      delta: entranceMean == null || exitMean == null ? null : round2(exitMean - entranceMean),
    }]);
  }
  return Object.fromEntries(measures);
}

function optionAggregates(question, respondents, counts) {
  return question.options.map((option) => {
    const count = counts.get(`${question.id}\u0000${option.id}`) || 0;
    return { id: option.id, label: option.label, count, percent: round2((count / respondents) * 100) };
  });
}

function scoredMean(question, options, respondents) {
  if (!question.options.every((option) => Number.isFinite(option.score))) return null;
  const scoreById = new Map(question.options.map((option) => [option.id, option.score]));
  return round2(options.reduce((sum, option) => sum + option.count * scoreById.get(option.id), 0) / respondents);
}

function countMap(rows) {
  return new Map(rows.map((row) => [`${row.questionId}\u0000${row.optionId}`, Number(row.count || 0)]));
}

function suppressedSection(collectionKey) {
  return { suppressed: true, publishedRespondents: 0, [collectionKey]: {} };
}

function releasedCount(hiddenTotal, threshold) {
  return hiddenTotal < threshold ? 0 : Math.floor(hiddenTotal / threshold) * threshold;
}

async function completedPhases(repository, eventId, attendeeId) {
  const rows = await repository.listCompletedPhases({ eventId, attendeeId });
  const phases = new Set(rows.map((row) => row.phase));
  return { entrance: phases.has("entrance"), exit: phases.has("exit") };
}

function assertExactObject(value, allowedKeys, requiredKeys) {
  if (!isPlainObject(value)) throw validationError("The request body must be a JSON object.");
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowedKeys.includes(key));
  if (unknown) throw validationError(`Unknown field: ${unknown}.`);
  const missing = requiredKeys.find((key) => !Object.hasOwn(value, key));
  if (missing) throw validationError(`Missing required field: ${missing}.`);
}

function assertAttendeeId(value) {
  if (typeof value !== "string" || !ATTENDEE_ID_PATTERN.test(value)) {
    throw validationError("attendeeId must be a UUID.");
  }
}

function assertPhase(phase) {
  if (!PHASES.includes(phase)) throw new AudienceError(404, "phase_not_found", "The response phase was not found.");
}

function isRecoveryCode(value) {
  return /^[0-9A-HJKMNP-TV-Z]{20}$/u.test(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recoveryFailure() {
  return new AudienceError(404, "recovery_not_found", "The recovery code could not be used.");
}

function validationError(message) {
  return new AudienceError(422, "validation_error", message);
}

function responseConflict() {
  return new AudienceError(409, "response_already_submitted", "This phase already has a different response.");
}

function payloadTooLarge() {
  return new AudienceError(413, "payload_too_large", `The request body must be ${MAX_JSON_BYTES} bytes or smaller.`);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
