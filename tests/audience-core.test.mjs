import assert from "node:assert/strict";
import test from "node:test";
import { questionsForPhase } from "../shared/audience-config.js";
import {
  AudienceError,
  createAudienceService,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  readJsonBody,
} from "../server/audience-core.js";

test("session creation stores only a recovery hash and recovery restores the opaque UUID", async () => {
  const { service, repository } = harness();
  const session = await service.createSession({});

  assert.match(session.attendeeId, /^[0-9a-f-]{36}$/u);
  assert.match(session.recoveryCode, /^(?:[0-9A-HJKMNP-TV-Z]{5}-){3}[0-9A-HJKMNP-TV-Z]{5}$/u);
  assert.equal(normalizeRecoveryCode(session.recoveryCode).length, 20);
  const stored = repository.attendees.get(session.attendeeId);
  assert.match(stored.recoveryHash, /^[0-9a-f]{64}$/u);
  assert.equal(stored.recoveryHash.includes(normalizeRecoveryCode(session.recoveryCode)), false);

  const recovered = await service.recoverSession({ recoveryCode: session.recoveryCode.toLowerCase() });
  assert.equal(recovered.attendeeId, session.attendeeId);
  assert.deepEqual(recovered.completed, { entrance: false, exit: false });
});

test("recovery codes contain exactly 20 Crockford characters and hash by event namespace", async () => {
  const code = generateRecoveryCode((length) => Uint8Array.from({ length }, (_, index) => index));
  assert.equal(code, "01234-56789-ABCDE-FGHJK");
  assert.equal(normalizeRecoveryCode(` ${code.toLowerCase()} `), "0123456789ABCDEFGHJK");
  assert.notEqual(await hashRecoveryCode("event-a", code), await hashRecoveryCode("event-b", code));
});

test("phase payloads accept only known multiple-choice questions and options", async () => {
  const { service } = harness();
  const session = await service.createSession({});

  await assert.rejects(
    service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: { freeText: ["hello"] },
    }),
    (error) => error instanceof AudienceError && error.status === 422,
  );
  await assert.rejects(
    service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: answersFor("entrance", "5", { first: ["not-an-option"] }),
    }),
    (error) => error instanceof AudienceError && error.status === 422,
  );
  await assert.rejects(
    service.createSession({ name: "Nobody" }),
    (error) => error instanceof AudienceError && error.status === 422,
  );
});

test("request JSON is capped at 8 KiB and requires application/json", async () => {
  await assert.rejects(
    readJsonBody(new Request("https://example.test/api", { method: "POST", body: "{}" })),
    (error) => error instanceof AudienceError && error.status === 415,
  );
  const oversized = JSON.stringify({ value: "x".repeat(8 * 1024) });
  await assert.rejects(
    readJsonBody(new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversized,
    })),
    (error) => error instanceof AudienceError && error.status === 413,
  );
});

test("phase submissions are write-once, identical retries are idempotent, and timestamps stay fixed", async () => {
  const { service, repository, clock } = harness();
  const session = await service.createSession({});
  const first = answersFor("entrance", "2");

  await service.replacePhaseResponse("entrance", { attendeeId: session.attendeeId, answers: first });
  const key = `${session.attendeeId}:entrance`;
  const initial = structuredClone(repository.submissions.get(key));
  clock.advance();
  await service.replacePhaseResponse("entrance", { attendeeId: session.attendeeId, answers: first });
  assert.deepEqual(repository.submissions.get(key), initial);

  await assert.rejects(
    service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: answersFor("entrance", "5"),
    }),
    (error) => error instanceof AudienceError
      && error.status === 409
      && error.code === "response_already_submitted",
  );
  assert.deepEqual(repository.submissions.get(key), initial);
});

test("public aggregates release only complete cohorts and reveal no hidden totals", async () => {
  const { service } = harness();
  const snapshots = [];
  for (let index = 1; index <= 6; index += 1) {
    const session = await service.createSession({});
    await service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: answersFor("entrance", String(Math.min(index, 5))),
    });
    snapshots.push(await service.getAggregates());
  }

  assert.deepEqual(snapshots[0].entrance, { suppressed: true, publishedRespondents: 0, questions: {} });
  assert.deepEqual(snapshots[1].entrance, { suppressed: true, publishedRespondents: 0, questions: {} });
  assert.equal(snapshots[2].entrance.publishedRespondents, 3);
  assert.deepEqual(snapshots[3], snapshots[2]);
  assert.deepEqual(snapshots[4], snapshots[2]);
  assert.equal(snapshots[5].entrance.publishedRespondents, 6);
  assert.notEqual(snapshots[5].version, snapshots[2].version);
  assert.equal(JSON.stringify(snapshots[3]).includes("hidden"), false);
  assert.equal(Object.hasOwn(snapshots[3].entrance, "totalRespondents"), false);
});

test("a rejected one-person change cannot alter an already released public snapshot", async () => {
  const { service } = harness();
  const sessions = [];
  for (let index = 0; index < 3; index += 1) {
    const session = await service.createSession({});
    sessions.push(session);
    await service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: answersFor("entrance", String(index + 1)),
    });
  }
  const before = await service.getAggregates();
  await assert.rejects(service.replacePhaseResponse("entrance", {
    attendeeId: sessions[0].attendeeId,
    answers: answersFor("entrance", "5"),
  }), (error) => error instanceof AudienceError && error.status === 409);
  assert.deepEqual(await service.getAggregates(), before);
});

test("paired entrance and exit results release only after three paired attendees", async () => {
  const { service } = harness();
  for (let index = 1; index <= 3; index += 1) {
    const session = await service.createSession({});
    await service.replacePhaseResponse("entrance", {
      attendeeId: session.attendeeId,
      answers: answersFor("entrance", String(index)),
    });
    if (index < 3) {
      await service.replacePhaseResponse("exit", {
        attendeeId: session.attendeeId,
        answers: answersFor("exit", String(index + 1)),
      });
    }
    const snapshot = await service.getAggregates();
    assert.equal(snapshot.paired.suppressed, true);
    if (index === 3) {
      await service.replacePhaseResponse("exit", {
        attendeeId: session.attendeeId,
        answers: answersFor("exit", "4"),
      });
    }
  }
  const snapshot = await service.getAggregates();
  assert.equal(snapshot.paired.suppressed, false);
  assert.equal(snapshot.paired.publishedRespondents, 3);
  const measure = snapshot.paired.measures["adapt-runtime"];
  assert.equal(measure.entrance.mean, 2);
  assert.equal(measure.exit.mean, 3);
  assert.equal(measure.delta, 1);
  assert.equal(JSON.stringify(snapshot.paired).includes("attendeeId"), false);
});

function answersFor(phase, optionId, { first } = {}) {
  return Object.fromEntries(questionsForPhase(phase).map((question, index) => [
    question.id,
    index === 0 && first ? first : [optionId],
  ]));
}

function harness() {
  const repository = new MemoryAudienceRepository();
  let uuidCounter = 0;
  let randomCounter = 0;
  let currentTime = 1_000;
  const service = createAudienceService({
    repository,
    eventId: "test-event",
    privacyThreshold: 3,
    now: () => currentTime,
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`,
    randomBytes: (length) => Uint8Array.from({ length }, (_, index) => (index + randomCounter++) & 255),
  });
  return {
    service,
    repository,
    clock: { advance: () => { currentTime += 1_000; } },
  };
}

class MemoryAudienceRepository {
  constructor() {
    this.attendees = new Map();
    this.submissions = new Map();
  }

  async createAttendee(record) {
    this.attendees.set(record.attendeeId, structuredClone(record));
  }

  async findAttendeeByRecoveryHash({ recoveryHash }) {
    const row = [...this.attendees.values()].find((attendee) => attendee.recoveryHash === recoveryHash);
    return row ? { attendeeId: row.attendeeId } : null;
  }

  async attendeeExists({ attendeeId }) {
    return this.attendees.has(attendeeId);
  }

  async listCompletedPhases({ attendeeId }) {
    return [...this.submissions.values()]
      .filter((submission) => submission.attendeeId === attendeeId)
      .map(({ phase }) => ({ phase }));
  }

  async getPhaseResponseHash({ attendeeId, phase }) {
    return this.submissions.get(`${attendeeId}:${phase}`)?.responseHash || null;
  }

  async replacePhaseResponse(record) {
    const key = `${record.attendeeId}:${record.phase}`;
    if (!this.submissions.has(key)) this.submissions.set(key, structuredClone(record));
    return this.submissions.get(key).responseHash;
  }

  async countPhaseRespondents({ phase }) {
    return [...this.submissions.values()].filter((submission) => submission.phase === phase).length;
  }

  async aggregatePhaseAnswers({ phase, limit }) {
    return aggregateRows(this.eligiblePhase(phase, limit), phase);
  }

  async countPairedRespondents() {
    return this.paired().length;
  }

  async aggregatePairedAnswers({ phase, limit }) {
    return aggregateRows(this.paired().slice(0, limit), phase);
  }

  eligiblePhase(phase, limit) {
    return [...this.submissions.values()]
      .filter((submission) => submission.phase === phase)
      .sort(byTimeAndAttendee)
      .slice(0, limit);
  }

  paired() {
    const byAttendee = new Map();
    for (const submission of this.submissions.values()) {
      if (!byAttendee.has(submission.attendeeId)) byAttendee.set(submission.attendeeId, []);
      byAttendee.get(submission.attendeeId).push(submission);
    }
    return [...byAttendee.values()]
      .filter((rows) => new Set(rows.map((row) => row.phase)).size === 2)
      .sort((left, right) => Math.max(...left.map((row) => row.submittedAt)) - Math.max(...right.map((row) => row.submittedAt))
        || left[0].attendeeId.localeCompare(right[0].attendeeId));
  }
}

function aggregateRows(records, phase) {
  const submissions = records.flat().filter((submission) => submission.phase === phase);
  const counts = new Map();
  for (const submission of submissions) {
    for (const answer of submission.answers) {
      for (const optionId of answer.optionIds) {
        const key = `${answer.questionId}\u0000${optionId}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }
  return [...counts.entries()].map(([key, count]) => {
    const [questionId, optionId] = key.split("\u0000");
    return { questionId, optionId, count };
  });
}

function byTimeAndAttendee(left, right) {
  return left.submittedAt - right.submittedAt || left.attendeeId.localeCompare(right.attendeeId);
}
