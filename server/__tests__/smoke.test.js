/**
 * Toolchain smoke test — server API layer.
 *
 * Proves the supertest harness is wired correctly:
 *   1. server.js can be `require()`d without binding a port (listen guard).
 *   2. The exported Express app is mountable by supertest.
 *   3. Real routes, middleware and JSON body parsing execute end to end.
 *
 * DATABASE POLICY (see TESTING.md for the full rationale):
 * These assertions deliberately exercise code paths that return BEFORE touching
 * MongoDB, so the suite runs in ~1s with no database, no Docker and no 141 MB
 * mongod download. Specs that genuinely need persistence (the ACL and auth
 * specs in AUDIT.md §8.7/§8.8) should opt in by setting TEST_MONGODB_URI.
 */
const request = require('supertest');
const mongoose = require('mongoose');

// Fail fast instead of buffering queries for the default 10s when no DB is
// connected. Without this, the /api/health assertion below would idle for 10s.
mongoose.set('bufferTimeoutMS', 1000);

// IMPORTANT — must run BEFORE `require('../server')`.
// server.js calls mongoose.connect(MONGODB_URI) at module scope on the default
// mongoose connection. Mongoose 8 throws "Can't call openUri() on an active
// connection with different connection strings" if anything later connects that
// same default connection to a different URI. So instead of opening a second
// connection here, we point the app itself at the test database: one URI, one
// connection, no conflict. `TEST_MONGODB_URI=... npm test` therefore works as a
// single self-contained switch.
if (process.env.TEST_MONGODB_URI) {
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
}

const { app } = require('../server');

const hasDb = () => mongoose.connection.readyState === 1;

beforeAll(async () => {
  // Opt-in real database. Unset by default — see TESTING.md.
  if (!process.env.TEST_MONGODB_URI) return;

  // The connection was already opened by server.js above with this exact URI;
  // just wait for it to finish handshaking. Raced against a timeout so that
  // "TEST_MONGODB_URI is set but nothing is listening" fails with a readable
  // message instead of an anonymous Jest timeout 30s later.
  await Promise.race([
    mongoose.connection.asPromise(),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `TEST_MONGODB_URI is set (${process.env.TEST_MONGODB_URI}) but no MongoDB ` +
                'answered within 10s. Start one (`mongod --dbpath ...`) or unset the ' +
                'variable to run the DB-free suite.'
            )
          ),
        10000
      )
    ),
  ]);
});

afterAll(async () => {
  // server.js opens its own mongoose connection at module scope; close it so
  // Jest has fewer dangling handles. `--forceExit` cleans up the rest (the Yjs
  // MongodbPersistence and the Socket.io engine both hold timers open).
  //
  // The close() is raced against a timeout on purpose: with no MongoDB running,
  // the connection sits in state 2 ("connecting") retrying forever, and close()
  // never settles — which would hang this hook until Jest kills the suite.
  await Promise.race([
    mongoose.connection.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
});

describe('server test toolchain', () => {
  it('exports the Express app without binding a port', () => {
    const { server } = require('../server');
    expect(typeof app).toBe('function');
    // The listen guard means requiring the module must NOT start the server.
    expect(server.listening).toBe(false);
  });

  it('runs middleware and validation on a public endpoint (no DB required)', async () => {
    // POST /api/waitlist rejects a malformed email before it ever queries Mongo,
    // so this exercises cors -> json body parser -> rate limiter -> route handler.
    const res = await request(app)
      .post('/api/waitlist')
      .send({ email: 'not-an-email' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid email address' });
  });

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
  });

  it('serves /api/health, reporting DB state honestly', async () => {
    // When no DB is configured we are deliberately driving the handler's catch
    // branch, which logs. Silence it so a passing run does not look like a crash.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/health');
    errSpy.mockRestore();

    if (hasDb()) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.documents).toBe('number');
    } else {
      // No database configured: the handler must degrade to a clean 503 rather
      // than hanging or throwing an unhandled rejection.
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
    }
  });
});
