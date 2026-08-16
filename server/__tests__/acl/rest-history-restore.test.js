/**
 * ACL regression gate — POST /api/documents/:shortId/restore/:historyId
 *
 * Guards AUDIT.md finding 5.2 (CRITICAL) / §8.8 spec S2:
 *   "POST /restore/:historyId never verifies the entry belongs to the target
 *    doc" — server/server.js:544-594.
 *
 * The handler checks `checkDocumentAccess(doc, req.user, 'editor')` on the
 * TARGET document, then does a bare `HistoryEntry.findById(req.params.historyId)`
 * and copies `entry.data.title` / `entry.data.elements` straight into that
 * target. Nothing ever compares `entry.documentId` to `doc._id`. MongoDB
 * ObjectIds are time-ordered, so an editor of doc A can enumerate a
 * HistoryEntry id belonging to doc B and pull B's snapshot content into A —
 * where they can then read it. That is a full confidentiality breach, not just
 * a corruption bug.
 *
 * The negative specs assert POST-FIX behaviour and FAIL today. They are
 * `test.skip` by default; run with ACL_EXPECT_FAIL=1 to watch them fail.
 * The positive specs are NOT skipped — they guard against over-blocking.
 */
const request = require('supertest');

const {
  addCollaborator,
  cleanupFixtures,
  closeDb,
  createDocument,
  describeWithDb,
  expectedFailUntilAclFix,
  fetchHistory,
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

describeDb('ACL — POST /:shortId/restore/:historyId (AUDIT finding 5.2)', () => {
  let owner; // owns every fixture document
  let attacker; // editor on `targetCollabId` only — no access to `sourceId`
  let viewer; // viewer collaborator on `restorableId`

  let sourceId; // holds the confidential snapshot
  let foreignHistoryId; // a HistoryEntry belonging to `sourceId`
  let targetSameOwnerId; // restore target for the same-owner cross-doc spec
  let targetCollabId; // restore target for the cross-tenant leak spec
  let restorableId; // subject of the positive restore spec

  const SOURCE_TITLE = 'CONFIDENTIAL — SOURCE DOCUMENT';
  const SOURCE_SECRET = 'INT. COFFRE-FORT - NUIT / the twist ending';
  const TARGET_TITLE = 'INNOCENT TARGET DOCUMENT';
  const TARGET_LINE = 'EXT. RUE - JOUR';

  const targetElements = () => [{ id: 'tgt-1', type: 'scene', content: TARGET_LINE }];

  beforeAll(async () => {
    await waitForDb();

    owner = await registerUser(app, 'restore-owner');
    attacker = await registerUser(app, 'restore-attacker');
    viewer = await registerUser(app, 'restore-viewer');

    sourceId = await createDocument(app, owner.token, {
      title: SOURCE_TITLE,
      elements: [
        { id: 'src-1', type: 'scene', content: SOURCE_SECRET },
        { id: 'src-2', type: 'action', content: 'Never meant to reach another document.' },
      ],
    });
    targetSameOwnerId = await createDocument(app, owner.token, {
      title: TARGET_TITLE,
      elements: targetElements(),
    });
    targetCollabId = await createDocument(app, owner.token, {
      title: TARGET_TITLE,
      elements: targetElements(),
    });
    restorableId = await createDocument(app, owner.token, {
      title: TARGET_TITLE,
      elements: targetElements(),
    });

    // The attacker is a legitimate EDITOR on the target only. They must never
    // be able to reach `sourceId`, directly or through a history id.
    await addCollaborator(Document, targetCollabId, attacker.id, 'editor');
    await addCollaborator(Document, restorableId, viewer.id, 'viewer');

    // POST /api/documents writes the document's first snapshot; that is the
    // entry an attacker would enumerate.
    const sourceHistory = await fetchHistory(app, owner.token, sourceId);
    expect(sourceHistory).toHaveLength(1);
    expect(sourceHistory[0].action).toBe('snapshot');
    foreignHistoryId = sourceHistory[0]._id;

    // Sanity: the attacker genuinely has no access to the source document.
    const sourceDoc = await Document.findOne({ shortId: sourceId }).select(
      'collaborators publicAccess'
    );
    expect(sourceDoc.publicAccess.enabled).toBe(false);
    expect(sourceDoc.collaborators).toHaveLength(0);
  });

  afterAll(async () => {
    await cleanupFixtures(
      { User, Document, HistoryEntry },
      {
        shortIds: [sourceId, targetSameOwnerId, targetCollabId, restorableId],
        userIds: [owner, attacker, viewer].filter(Boolean).map((u) => u.id),
      }
    );
    await closeDb();
  });

  // ---------------------------------------------------------------------
  // B. Expected failures — the actual finding.
  // ---------------------------------------------------------------------

  // EXPECTED FAIL until the ACL fix lands — AUDIT.md finding 5.2 (§7 Phase 2 step 2).
  // TODAY: returns 200 and overwrites the target with the other document's
  // snapshot (cross-document restore succeeds).
  //
  // Deliberately run as the OWNER of BOTH documents: that isolates the missing
  // `entry.documentId.equals(doc._id)` check from the ACL check. A fix that only
  // tightened access control would still leave this spec failing.
  expectedFail(
    'refuses a history entry that belongs to a different document',
    async () => {
      const res = await request(app)
        .post(`/api/documents/${targetSameOwnerId}/restore/${foreignHistoryId}`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBeUndefined();

      // And the target must be byte-for-byte untouched.
      const doc = await Document.findOne({ shortId: targetSameOwnerId });
      expect(doc.title).toBe(TARGET_TITLE);
      expect(doc.elements).toHaveLength(1);
      expect(doc.elements[0].content).toBe(TARGET_LINE);
    }
  );

  // EXPECTED FAIL until the ACL fix lands — AUDIT.md finding 5.2.
  // This is the confidentiality half of the finding: TODAY an editor of one
  // document pulls another owner's snapshot into a document they can read.
  expectedFail(
    'does not leak another document\'s content to an editor of the target document',
    async () => {
      const res = await request(app)
        .post(`/api/documents/${targetCollabId}/restore/${foreignHistoryId}`)
        .set('Authorization', `Bearer ${attacker.token}`);

      expect([400, 403, 404]).toContain(res.status);

      // The decisive assertion: the confidential line must never become
      // readable through the target document.
      const readBack = await request(app)
        .get(`/api/documents/${targetCollabId}`)
        .set('Authorization', `Bearer ${attacker.token}`);
      expect(JSON.stringify(readBack.body)).not.toContain(SOURCE_SECRET);
      expect(readBack.body.title).not.toBe(SOURCE_TITLE);
    }
  );

  // ---------------------------------------------------------------------
  // D. Positive paths — must pass today AND after the fix.
  // ---------------------------------------------------------------------

  test('owner can restore a history entry that belongs to their own document', async () => {
    const history = await fetchHistory(app, owner.token, restorableId);
    const ownEntry = history.find((h) => h.action === 'snapshot');
    expect(ownEntry).toBeDefined();

    // Drift the document away from the snapshot so the restore is observable.
    await Document.updateOne(
      { shortId: restorableId },
      {
        $set: {
          title: 'DRIFTED TITLE',
          elements: [{ id: 'drift-1', type: 'action', content: 'Typed after the snapshot.' }],
        },
      }
    );

    const res = await request(app)
      .post(`/api/documents/${restorableId}/restore/${ownEntry._id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await Document.findOne({ shortId: restorableId });
    expect(doc.title).toBe(TARGET_TITLE);
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0].content).toBe(TARGET_LINE);
  });

  test('a viewer-role collaborator cannot restore (403)', async () => {
    const history = await fetchHistory(app, owner.token, restorableId);
    const ownEntry = history.find((h) => h.action === 'snapshot');

    const res = await request(app)
      .post(`/api/documents/${restorableId}/restore/${ownEntry._id}`)
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(403);
  });

  test('an unauthenticated restore is rejected with 401', async () => {
    const res = await request(app).post(
      `/api/documents/${restorableId}/restore/${foreignHistoryId}`
    );

    expect(res.status).toBe(401);
  });
});
