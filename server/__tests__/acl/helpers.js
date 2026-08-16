/**
 * Shared fixtures for the server access-control (ACL) regression specs.
 *
 * This file is deliberately NOT named `*.test.js`: server/package.json's
 * `testMatch` only collects files whose name ends in `.test.js`, so Jest treats
 * this as a plain module and never tries to run it as a suite.
 *
 * DATABASE POLICY (see TESTING.md §2)
 * ----------------------------------
 * Every ACL spec needs real Users, Documents and HistoryEntries, so the whole
 * ACL directory is gated on `TEST_MONGODB_URI`. Without it the suites report
 * "skipped" and the runner still exits 0 — same contract as the smoke spec.
 *
 *   mkdir -p /tmp/rooms-test-db && mongod --dbpath /tmp/rooms-test-db &
 *   cd server && TEST_MONGODB_URI=mongodb://localhost:27017/rooms-test npm test
 *
 * These helpers never drop a database: they create uniquely-named fixtures and
 * delete exactly those documents in `afterAll`, so pointing TEST_MONGODB_URI at
 * a scratch dev database cannot destroy unrelated data.
 */
const request = require('supertest');
const mongoose = require('mongoose');

const TEST_PASSWORD = 'acl-spec-password-123';

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Point the application itself at the test database.
 *
 * MUST be called BEFORE `require('../../server')`. server.js calls
 * mongoose.connect(MONGODB_URI) at module scope on the DEFAULT mongoose
 * connection; Mongoose 8 throws if anything later connects that same default
 * connection to a different URI. So the spec must never open a second
 * connection — it rewrites the env var the app reads. See TESTING.md §2.
 *
 * @returns {boolean} true when a test database was configured.
 */
function useTestDatabase() {
  // Fail fast instead of buffering queries for the default 10s.
  mongoose.set('bufferTimeoutMS', 2000);
  if (process.env.TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  }
  return Boolean(process.env.TEST_MONGODB_URI);
}

const hasTestDatabase = () => Boolean(process.env.TEST_MONGODB_URI);

/**
 * `describe` when a test database is configured, `describe.skip` otherwise.
 */
const describeWithDb = () => (hasTestDatabase() ? describe : describe.skip);

/**
 * A spec that encodes CORRECT post-fix behaviour the server does not implement
 * yet. It is `test.skip` by default so the suite stays green, and becomes a
 * real `test` under `ACL_EXPECT_FAIL=1` so anyone can prove — on demand, today —
 * that the hole is still open:
 *
 *   cd server && TEST_MONGODB_URI=... ACL_EXPECT_FAIL=1 npm test
 *
 * After the ACL fix lands, delete this indirection and use plain `test`.
 */
const expectedFailUntilAclFix = () =>
  hasTestDatabase() && process.env.ACL_EXPECT_FAIL === '1' ? test : test.skip;

/**
 * Wait for the connection server.js already opened. Raced against a timer so
 * "TEST_MONGODB_URI is set but nothing is listening" fails with a readable
 * message instead of an anonymous Jest timeout.
 */
async function waitForDb(timeoutMs = 10000) {
  await Promise.race([
    mongoose.connection.asPromise(),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `TEST_MONGODB_URI is set (${process.env.TEST_MONGODB_URI}) but no MongoDB ` +
                `answered within ${timeoutMs / 1000}s. Start one (\`mongod --dbpath ...\`) ` +
                'or unset the variable to run the DB-free suite.'
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

async function closeDb() {
  // With no MongoDB running the connection sits in state 2 ("connecting")
  // retrying forever and close() never settles — hence the race.
  await Promise.race([
    mongoose.connection.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

/**
 * Register a real user through the real endpoint and return its credentials.
 * Going through POST /api/auth/register (rather than writing a User document
 * directly) keeps the spec decoupled from JWT internals.
 */
async function registerUser(app, label) {
  const email = `acl-${label}-${uniqueSuffix()}@rooms.test`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: TEST_PASSWORD, name: `ACL ${label}` });

  if (res.status !== 201) {
    throw new Error(
      `Fixture setup failed: could not register "${label}" (status ${res.status}, ` +
        `body ${JSON.stringify(res.body)})`
    );
  }
  return { id: res.body.user.id, email, name: res.body.user.name, token: res.body.token };
}

/**
 * Create a document via POST /api/documents. That route also writes the
 * document's first HistoryEntry snapshot, which the restore specs rely on.
 */
async function createDocument(app, token, { title, elements }) {
  const res = await request(app)
    .post('/api/documents')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, elements });

  if (res.status !== 200 || !res.body.id) {
    throw new Error(
      `Fixture setup failed: could not create document "${title}" ` +
        `(status ${res.status}, body ${JSON.stringify(res.body)})`
    );
  }
  return res.body.id; // shortId
}

/**
 * Add an EXPLICIT collaborator. There is no REST route for this today — the
 * only production path is the Socket.io auto-add at server.js:823 — so the
 * fixture writes the collaborator entry directly, which is exactly what an
 * invite flow would persist.
 */
async function addCollaborator(Document, shortId, userId, role) {
  const result = await Document.updateOne(
    { shortId },
    { $push: { collaborators: { userId: new mongoose.Types.ObjectId(userId), role } } }
  );
  if (result.matchedCount !== 1) {
    throw new Error(`Fixture setup failed: no document with shortId "${shortId}"`);
  }
}

async function fetchHistory(app, token, shortId) {
  const res = await request(app)
    .get(`/api/documents/${shortId}/history`)
    .set('Authorization', `Bearer ${token}`);
  if (res.status !== 200) {
    throw new Error(
      `Fixture setup failed: could not read history of "${shortId}" (status ${res.status})`
    );
  }
  return res.body.history;
}

/**
 * Delete exactly the fixtures this run created. Never drops a database.
 */
async function cleanupFixtures({ User, Document, HistoryEntry }, { shortIds = [], userIds = [] }) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const docs = await Document.find({ shortId: { $in: shortIds } }).select('_id');
    if (docs.length) {
      await HistoryEntry.deleteMany({ documentId: { $in: docs.map((d) => d._id) } });
    }
    await Document.deleteMany({ shortId: { $in: shortIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  } catch (err) {
    // Cleanup failure must not turn a passing suite red; surface it instead.
    console.warn('[ACL SPEC] fixture cleanup failed:', err.message);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll `predicate` until it is truthy or the budget runs out. */
async function waitUntil(predicate, timeoutMs = 3000, stepMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return Boolean(predicate());
}

module.exports = {
  TEST_PASSWORD,
  addCollaborator,
  cleanupFixtures,
  closeDb,
  createDocument,
  describeWithDb,
  expectedFailUntilAclFix,
  fetchHistory,
  hasTestDatabase,
  registerUser,
  sleep,
  uniqueSuffix,
  useTestDatabase,
  waitForDb,
  waitUntil,
};
