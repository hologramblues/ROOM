/**
 * ACL regression gate — Socket.io `join-document` authorization
 *
 * Guards AUDIT.md finding 5.1b (CRITICAL) / §8.6 spec C6, the half of 5.1 the
 * REST fix could not reach.
 *
 * THE DEFECT (server/server.js, `join-document`, formerly lines 838-848):
 *
 *     } else {
 *       // New user accessing via shared link — auto-add as editor collaborator
 *       await Document.updateOne(
 *         { shortId: docId, 'collaborators.userId': { $ne: socket.user._id } },
 *         { $push: { collaborators: { userId: socket.user._id, role: 'editor' } } }
 *       );
 *       role = 'editor';
 *     }
 *
 * That branch is only reachable when `checkDocumentAccess` already passed for a
 * non-owner, non-collaborator — i.e. `publicAccess.enabled` is true. So an owner
 * who shared a link as `publicAccess: { role: 'viewer' }` got this instead: the
 * visitor's FIRST socket join permanently wrote `role: 'editor'` into
 * `doc.collaborators`. One code path defeated two CRITICAL fixes:
 *
 *   5.1 — the next `GET /api/documents/:shortId` read the row back and
 *         legitimately reported `editor`, because the DB now said so.
 *   5.3 — `yjs-server.js` derives `canWrite` from `checkDocAccess` against that
 *         same row, so the "viewer" could mutate the shared CRDT.
 *
 * FIXED — design (b), DO NOT PERSIST. The join now derives the role from
 * `doc.publicAccess.role` on every join and writes nothing. This matches the 5.1
 * REST fix (which already derives ephemerally) and, decisively, keeps the link
 * REVOCABLE: ShareModal has no UI listing or removing collaborator rows, so a
 * persisted grant would have been permanent and invisible to the owner. Spec E1
 * below is the assertion that only design (b) can pass.
 *
 * HARNESS — the honest answer. This is a REAL Socket.io test. It boots the
 * exported HTTP server on an ephemeral port (`server.listen(0)`; `io` is bound to
 * that same server by server.js:16), connects genuine `socket.io-client` sockets
 * carrying real JWTs from `POST /api/auth/register`, and asserts on the
 * `document-state` / `error` frames the server actually emits. The persistence
 * half is then checked against the live database. Nothing is stubbed, and no
 * server internal (`activeRooms`, the handler closure) is reached into, so a fix
 * is free to restructure them without breaking this spec.
 *
 * `socket.io-client` was added as a devDependency for this file — the server
 * package previously shipped only the `socket.io` server half.
 */
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');

const {
  addCollaborator,
  cleanupFixtures,
  closeDb,
  createDocument,
  describeWithDb,
  registerUser,
  sleep,
  useTestDatabase,
  waitForDb,
} = require('./helpers');

// MUST run before require('../../server') — see helpers.useTestDatabase.
useTestDatabase();

const { app, server } = require('../../server');
const { User, Document, HistoryEntry } = require('../../models');

const describeDb = describeWithDb();

const JOIN_TIMEOUT_MS = 6000;

/**
 * Flip the public share link through the REAL owner-only route the ShareModal
 * calls, rather than writing `publicAccess` straight into Mongo. That keeps the
 * fixture on the same path a user takes and proves the route and the join agree.
 */
async function setPublicAccess(token, shortId, { enabled, role }) {
  const res = await request(app)
    .put(`/api/documents/${shortId}/public-access`)
    .set('Authorization', `Bearer ${token}`)
    .send({ enabled, role });
  if (res.status !== 200) {
    throw new Error(
      `Fixture setup failed: could not set publicAccess on "${shortId}" ` +
        `(status ${res.status}, body ${JSON.stringify(res.body)})`
    );
  }
  return res.body.publicAccess;
}

/**
 * Connect a real socket and emit `join-document`, resolving with whichever the
 * server answers FIRST.
 *
 *   { outcome: 'joined',  state }    — a `document-state` frame arrived
 *   { outcome: 'refused', error }    — an `error` frame arrived, no join
 *
 * Racing the two events (instead of awaiting `document-state` and treating a
 * timeout as refusal) is what makes the refusal specs meaningful: a server that
 * simply got slower would fail loudly rather than look like a successful deny.
 */
function joinDocument(port, token, docId) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: JOIN_TIMEOUT_MS,
      forceNew: true,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timed out waiting for a join-document answer for "${docId}"`));
    }, JOIN_TIMEOUT_MS);

    const settle = (value) => {
      clearTimeout(timer);
      resolve({ ...value, socket });
    };

    socket.on('document-state', (state) => settle({ outcome: 'joined', state }));
    socket.on('error', (error) => settle({ outcome: 'refused', error }));
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error(`Socket handshake failed: ${err.message}`));
    });
    socket.on('connect', () => socket.emit('join-document', { docId }));
  });
}

/** The collaborator row for `userId`, straight from the database, or undefined. */
async function collaboratorRow(shortId, userId) {
  const doc = await Document.findOne({ shortId }).select('collaborators');
  return doc.collaborators.find((c) => c.userId.toString() === userId.toString());
}

describeDb('ACL — Socket.io join-document authorization (AUDIT finding 5.1b)', () => {
  let owner;
  let visitor; // never invited to anything — only ever holds a link
  let viewerCollab; // explicitly invited as viewer
  let viewerLinkDocId; // publicAccess { enabled: true, role: 'viewer' }
  let editorLinkDocId; // publicAccess { enabled: true, role: 'editor' }
  let privateDocId; // publicAccess disabled
  let invitedDocId; // has an explicit viewer collaborator AND an editor link
  let revocableDocId; // link is downgraded mid-spec
  let port;

  const openSockets = [];
  const track = (result) => {
    if (result && result.socket) openSockets.push(result.socket);
    return result;
  };

  beforeAll(async () => {
    await waitForDb();

    owner = await registerUser(app, 'join-owner');
    visitor = await registerUser(app, 'join-visitor');
    viewerCollab = await registerUser(app, 'join-viewer-collab');

    const mk = (title) =>
      createDocument(app, owner.token, {
        title,
        elements: [{ id: 'j-1', type: 'scene', content: 'INT. ACL SUITE - JOUR' }],
      });

    viewerLinkDocId = await mk('JOIN ACL — VIEWER LINK');
    editorLinkDocId = await mk('JOIN ACL — EDITOR LINK');
    privateDocId = await mk('JOIN ACL — PRIVATE');
    invitedDocId = await mk('JOIN ACL — INVITED VIEWER');
    revocableDocId = await mk('JOIN ACL — REVOCABLE LINK');

    await setPublicAccess(owner.token, viewerLinkDocId, { enabled: true, role: 'viewer' });
    await setPublicAccess(owner.token, editorLinkDocId, { enabled: true, role: 'editor' });
    // `privateDocId` keeps the creation default: { enabled: false, role: 'viewer' }.
    await setPublicAccess(owner.token, invitedDocId, { enabled: true, role: 'editor' });
    await addCollaborator(Document, invitedDocId, viewerCollab.id, 'viewer');
    await setPublicAccess(owner.token, revocableDocId, { enabled: true, role: 'editor' });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      try {
        socket.disconnect();
      } catch (_) {
        /* already gone */
      }
    }
    await sleep(100);
    await new Promise((resolve) => server.close(resolve));

    await cleanupFixtures(
      { User, Document, HistoryEntry },
      {
        shortIds: [
          viewerLinkDocId,
          editorLinkDocId,
          privateDocId,
          invitedDocId,
          revocableDocId,
        ].filter(Boolean),
        userIds: [owner, visitor, viewerCollab].filter(Boolean).map((u) => u.id),
      }
    );
    await closeDb();
  });

  // ---------------------------------------------------------------------
  // E. The actual finding — regression gate for AUDIT 5.1b.
  // ---------------------------------------------------------------------

  test(
    'E1 — a viewer-role public link never yields the editor role, and persists nothing',
    async () => {
      const result = track(await joinDocument(port, visitor.token, viewerLinkDocId));

      // Half one: the role reported back over the wire.
      expect(result.outcome).toBe('joined');
      expect(result.state.role).toBe('viewer');
      expect(result.state.role).not.toBe('editor');

      // Half two: nothing was written. This is what defeated 5.1 and 5.3 — the
      // next GET read `editor` back out of the database, and yjs-server.js's
      // checkDocAccess passed `editor` against the same row.
      const row = await collaboratorRow(viewerLinkDocId, visitor.id);
      expect(row).toBeUndefined();

      // And the visitor is not advertised in the collaborator roster either.
      const roster = result.state.collaborators || [];
      expect(roster.some((c) => c.userId.toString() === visitor.id)).toBe(false);
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'E2 — the escalation does not leak back through the REST route afterwards',
    async () => {
      // The end-to-end shape of the original bug: GET says viewer, socket join
      // rewrites the DB, second GET says editor. Re-runs the join first so this
      // spec is independent of E1's ordering.
      track(await joinDocument(port, visitor.token, viewerLinkDocId));

      const res = await request(app)
        .get(`/api/documents/${viewerLinkDocId}`)
        .set('Authorization', `Bearer ${visitor.token}`);

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('viewer');
      expect(res.body.isOwner).toBeFalsy();
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'E3 — revoking the link takes effect on the next join (design (b) only)',
    async () => {
      // Under design (a) — persist with the correct role — this spec fails: the
      // first join would write an `editor` row that outlives the downgrade, and
      // ShareModal offers the owner no way to see or delete it.
      const first = track(await joinDocument(port, visitor.token, revocableDocId));
      expect(first.outcome).toBe('joined');
      expect(first.state.role).toBe('editor');

      await setPublicAccess(owner.token, revocableDocId, { enabled: true, role: 'viewer' });
      const downgraded = track(await joinDocument(port, visitor.token, revocableDocId));
      expect(downgraded.outcome).toBe('joined');
      expect(downgraded.state.role).toBe('viewer');

      await setPublicAccess(owner.token, revocableDocId, { enabled: false });
      const revoked = track(await joinDocument(port, visitor.token, revocableDocId));
      expect(revoked.outcome).toBe('refused');
      expect(revoked.error.message).toBe('Acces refuse');
    },
    JOIN_TIMEOUT_MS * 3 + 6000
  );

  // ---------------------------------------------------------------------
  // D. Over-block guards — the fix must not deny anyone who is entitled.
  // ---------------------------------------------------------------------

  test(
    'D12 — an editor-role public link legitimately yields the editor role',
    async () => {
      const result = track(await joinDocument(port, visitor.token, editorLinkDocId));
      expect(result.outcome).toBe('joined');
      expect(result.state.role).toBe('editor');

      // Still ephemeral: the right role, granted without a persisted grant.
      const row = await collaboratorRow(editorLinkDocId, visitor.id);
      expect(row).toBeUndefined();
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'D13 — a non-collaborator join is refused when public access is disabled',
    async () => {
      const result = track(await joinDocument(port, visitor.token, privateDocId));
      expect(result.outcome).toBe('refused');
      expect(result.error.message).toBe('Acces refuse');

      // Refused means refused: no room membership, and no consolation row.
      const row = await collaboratorRow(privateDocId, visitor.id);
      expect(row).toBeUndefined();

      // A refused socket must not receive later room traffic either. Give the
      // handler a beat, then confirm no document-state ever showed up.
      let leaked = false;
      result.socket.on('document-state', () => {
        leaked = true;
      });
      await sleep(300);
      expect(leaked).toBe(false);
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'D14 — an explicitly invited viewer keeps their invited role, and is not upgraded',
    async () => {
      // `invitedDocId` also carries an EDITOR link. The invited row must win, or
      // the public link would silently promote every invited viewer on the doc.
      const result = track(await joinDocument(port, viewerCollab.token, invitedDocId));
      expect(result.outcome).toBe('joined');
      expect(result.state.role).toBe('viewer');

      const row = await collaboratorRow(invitedDocId, viewerCollab.id);
      expect(row).toBeDefined();
      expect(row.role).toBe('viewer');
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'D15 — the owner still joins as editor',
    async () => {
      const result = track(await joinDocument(port, owner.token, viewerLinkDocId));
      expect(result.outcome).toBe('joined');
      expect(result.state.role).toBe('editor');

      // The owner is reported through the roster, not through a collaborator row.
      const roster = result.state.collaborators || [];
      expect(roster.some((c) => c.userId.toString() === owner.id && c.role === 'owner')).toBe(true);
      const row = await collaboratorRow(viewerLinkDocId, owner.id);
      expect(row).toBeUndefined();
    },
    JOIN_TIMEOUT_MS + 4000
  );

  test(
    'D16 — an unauthenticated socket cannot join at all',
    async () => {
      // socketAuthMiddleware (auth.js:52) admits tokenless sockets with
      // socket.user = null; join-document is where they are turned away.
      const result = track(await joinDocument(port, undefined, viewerLinkDocId));
      expect(result.outcome).toBe('refused');
      expect(result.error.message).toBe('Authentification requise');
    },
    JOIN_TIMEOUT_MS + 4000
  );
});
