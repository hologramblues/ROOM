/**
 * ACL regression gate — GET /api/documents/:shortId
 *
 * Guards AUDIT.md finding 5.1 (CRITICAL) / §8.8 spec S1:
 *   "GET /api/documents/:shortId has no ACL and auto-promotes any authenticated
 *    visitor to `editor`" — server/server.js:485.
 *
 * The route runs `authMiddleware` and then hands the FULL document (title,
 * elements, comments, suggestions, beat-board data) to anybody holding a valid
 * JWT, and reports `role: 'editor'` for a user who is neither owner nor
 * collaborator (server.js:497 — `else userRole = 'editor';`). shortId is 8 hex
 * chars (server.js:254), so the id is guessable as well as leakable.
 *
 * The negative specs below assert the POST-FIX behaviour and therefore FAIL
 * today. They are `test.skip` by default (see helpers.expectedFailUntilAclFix)
 * so the suite stays green; run with ACL_EXPECT_FAIL=1 to watch them fail.
 *
 * The positive specs are NOT skipped — they must pass both before and after the
 * fix, which is what stops the fix from over-blocking legitimate readers.
 */
const request = require('supertest');

const {
  addCollaborator,
  cleanupFixtures,
  closeDb,
  createDocument,
  describeWithDb,
  expectedFailUntilAclFix,
  registerUser,
  useTestDatabase,
  waitForDb,
} = require('./helpers');

// MUST run before require('../../server') — see helpers.useTestDatabase.
useTestDatabase();

const { app } = require('../../server');
const { User, Document, HistoryEntry } = require('../../models');

const describeDb = describeWithDb();
const expectedFail = expectedFailUntilAclFix();

describeDb('ACL — GET /api/documents/:shortId (AUDIT finding 5.1)', () => {
  let owner; // creates the document
  let stranger; // authenticated, but NOT owner and NOT a collaborator
  let editorCollab; // explicitly invited, role: editor
  let viewerCollab; // explicitly invited, role: viewer
  let shortId;

  const DOC_TITLE = 'ACL FIXTURE — PRIVATE SCREENPLAY';
  const SECRET_LINE = 'INT. SALLE DES SCENARISTES - NUIT';

  beforeAll(async () => {
    await waitForDb();

    owner = await registerUser(app, 'owner');
    stranger = await registerUser(app, 'stranger');
    editorCollab = await registerUser(app, 'editor');
    viewerCollab = await registerUser(app, 'viewer');

    shortId = await createDocument(app, owner.token, {
      title: DOC_TITLE,
      elements: [
        { id: 'el-1', type: 'scene', content: SECRET_LINE },
        { id: 'el-2', type: 'action', content: 'Confidential draft material.' },
      ],
    });

    await addCollaborator(Document, shortId, editorCollab.id, 'editor');
    await addCollaborator(Document, shortId, viewerCollab.id, 'viewer');

    // The document must be private for the negative specs to mean anything.
    const doc = await Document.findOne({ shortId }).select('publicAccess');
    expect(doc.publicAccess.enabled).toBe(false);
  });

  afterAll(async () => {
    await cleanupFixtures(
      { User, Document, HistoryEntry },
      {
        shortIds: [shortId],
        userIds: [owner, stranger, editorCollab, viewerCollab].filter(Boolean).map((u) => u.id),
      }
    );
    await closeDb();
  });

  // ---------------------------------------------------------------------
  // A. Expected failures — the actual finding.
  // ---------------------------------------------------------------------

  // EXPECTED FAIL until the ACL fix lands — AUDIT.md finding 5.1 (§7 Phase 2 step 1).
  // TODAY: returns 200 with the full document body.
  expectedFail(
    'rejects a non-collaborator with 403 and leaks no document content',
    async () => {
      const res = await request(app)
        .get(`/api/documents/${shortId}`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
      // A 403 must not carry the payload it just refused.
      expect(res.body.elements).toBeUndefined();
      expect(res.body.title).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(SECRET_LINE);
    }
  );

  // EXPECTED FAIL until the ACL fix lands — AUDIT.md finding 5.1.
  // TODAY: server.js:497 answers `role: 'editor'` for a user who was never
  // invited ("Will be auto-added as collaborator on socket join"), which is the
  // silent promotion the finding names.
  expectedFail('never advertises an editor role to a non-collaborator', async () => {
    const res = await request(app)
      .get(`/api/documents/${shortId}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.body.role).not.toBe('editor');
    expect(res.body.isOwner).toBeFalsy();

    // The read must also stay side-effect free: no collaborator entry appears.
    // (This half already holds today — the DB-level auto-add lives on the
    // Socket.io join path, server.js:823, covered by AUDIT §8.6 spec C6.)
    const doc = await Document.findOne({ shortId }).select('collaborators');
    const promoted = doc.collaborators.some((c) => c.userId.equals(stranger.id));
    expect(promoted).toBe(false);
  });

  // ---------------------------------------------------------------------
  // D. Positive paths — these must pass today AND after the fix.
  //    They are the over-blocking guard.
  // ---------------------------------------------------------------------

  test('owner can read their own document', async () => {
    const res = await request(app)
      .get(`/api/documents/${shortId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(shortId);
    expect(res.body.title).toBe(DOC_TITLE);
    expect(res.body.isOwner).toBe(true);
    expect(res.body.role).toBe('editor');
    expect(res.body.elements).toHaveLength(2);
    expect(res.body.elements[0].content).toBe(SECRET_LINE);
  });

  test('explicit editor collaborator can read the document', async () => {
    const res = await request(app)
      .get(`/api/documents/${shortId}`)
      .set('Authorization', `Bearer ${editorCollab.token}`);

    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
    expect(res.body.role).toBe('editor');
    expect(res.body.elements[0].content).toBe(SECRET_LINE);
  });

  test('explicit viewer collaborator can read the document, with viewer role', async () => {
    const res = await request(app)
      .get(`/api/documents/${shortId}`)
      .set('Authorization', `Bearer ${viewerCollab.token}`);

    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
    expect(res.body.role).toBe('viewer');
    expect(res.body.elements[0].content).toBe(SECRET_LINE);
  });

  test('unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get(`/api/documents/${shortId}`);

    expect(res.status).toBe(401);
    expect(res.body.elements).toBeUndefined();
  });

  test('a malformed token is rejected with 401', async () => {
    const res = await request(app)
      .get(`/api/documents/${shortId}`)
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(res.status).toBe(401);
    expect(res.body.elements).toBeUndefined();
  });
});
