/**
 * ACL regression gate — Yjs WebSocket write authorization
 *
 * Guards AUDIT.md finding 5.3 (CRITICAL) / §8.4 spec C3:
 *   "Yjs WebSocket only checks `viewer` at connect; every subsequent message is
 *    accepted" — server/yjs-server.js:234 and 286-312.
 *
 * yjs-server.js:234 runs `checkDocAccess(doc, user, 'viewer')` ONCE, during the
 * `connection` event. The `ws.on('message')` handler at line 286 then feeds any
 * `messageSync` frame straight into `syncProtocol.readSyncMessage(..., ydoc, null)`
 * (line 296) with no role check at all. A viewer- or commenter-role collaborator
 * — or an anonymous visitor on a `publicAccess.role = 'viewer'` document — can
 * therefore mutate the shared CRDT that every editor is looking at.
 *
 * HARNESS — what this file actually does (honest answer to the task's option C):
 * This is a REAL WebSocket test, not a unit test and not a placeholder. It boots
 * the exported HTTP server on an ephemeral port (the Yjs upgrade handler is
 * attached to it by server.js:22), connects genuine `ws` clients carrying real
 * JWTs, speaks the real lib0/y-protocols sync protocol, and then verifies the
 * server-side state by connecting a SECOND client as the owner and reading the
 * SyncStep2 the server sends it. No internals are stubbed or re-implemented, so
 * the assertion is on observable protocol behaviour rather than on a function
 * that a fix might rename or move.
 *
 * The negative spec asserts POST-FIX behaviour and FAILS today. It is
 * `test.skip` by default; run with ACL_EXPECT_FAIL=1 to watch it fail.
 * The positive spec is NOT skipped — it proves the fix does not break editors.
 */
const WebSocket = require('ws');
const mongoose = require('mongoose');
const Y = require('yjs');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const syncProtocol = require('y-protocols/sync');

const {
  addCollaborator,
  cleanupFixtures,
  closeDb,
  createDocument,
  describeWithDb,
  expectedFailUntilAclFix,
  registerUser,
  sleep,
  useTestDatabase,
  waitForDb,
  waitUntil,
} = require('./helpers');

// MUST run before require('../../server') — see helpers.useTestDatabase.
useTestDatabase();

const { app, server } = require('../../server');
const { User, Document, HistoryEntry } = require('../../models');

const describeDb = describeWithDb();
const expectedFail = expectedFailUntilAclFix();

// Message type constants — mirror yjs-server.js:51-52.
const MESSAGE_SYNC = 0;

const FRAGMENT_NAME = 'default'; // what TipTap Collaboration binds to

/** Minimal but faithful Yjs websocket client. */
function connectYjs(port, docName, token) {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    const query = token === null ? '' : `?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/yjs/${docName}${query}`);

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Timed out connecting to /yjs/${docName}`));
    }, 8000);

    ws.on('message', (data) => {
      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return; // ignore awareness
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, ydoc, ws);
        if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
      } catch (err) {
        // A malformed frame must not take the whole suite down.
        console.warn('[ACL SPEC] yjs client decode error:', err.message);
      }
    });

    ws.on('open', () => {
      clearTimeout(timer);
      resolve({ ws, ydoc });
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Insert one paragraph into the shared fragment and push the diff upstream. */
function sendParagraph(client, text) {
  const before = Y.encodeStateVector(client.ydoc);
  const fragment = client.ydoc.getXmlFragment(FRAGMENT_NAME);
  const paragraph = new Y.XmlElement('paragraph');
  paragraph.insert(0, [new Y.XmlText(text)]);
  fragment.insert(fragment.length, [paragraph]);

  const update = Y.encodeStateAsUpdate(client.ydoc, before);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  client.ws.send(encoding.toUint8Array(encoder));
}

const fragmentText = (client) =>
  client.ydoc.getXmlFragment(FRAGMENT_NAME).toString();
const fragmentLength = (client) =>
  client.ydoc.getXmlFragment(FRAGMENT_NAME).length;

describeDb('ACL — Yjs WebSocket write authorization (AUDIT finding 5.3)', () => {
  let owner;
  let viewerCollab;
  let editorCollab;
  let viewerTargetId; // document the viewer will try to mutate
  let editorTargetId; // document the editor legitimately mutates
  let port;
  const openClients = [];

  const track = (client) => {
    openClients.push(client);
    return client;
  };

  beforeAll(async () => {
    await waitForDb();

    owner = await registerUser(app, 'yjs-owner');
    viewerCollab = await registerUser(app, 'yjs-viewer');
    editorCollab = await registerUser(app, 'yjs-editor');

    viewerTargetId = await createDocument(app, owner.token, {
      title: 'YJS ACL — VIEWER TARGET',
      elements: [{ id: 'y-1', type: 'scene', content: '' }],
    });
    editorTargetId = await createDocument(app, owner.token, {
      title: 'YJS ACL — EDITOR TARGET',
      elements: [{ id: 'y-2', type: 'scene', content: '' }],
    });

    await addCollaborator(Document, viewerTargetId, viewerCollab.id, 'viewer');
    await addCollaborator(Document, editorTargetId, editorCollab.id, 'editor');

    // Bind the real HTTP server (Yjs upgrade handler included) to a free port.
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    for (const client of openClients) {
      try {
        client.ws.close();
      } catch (_) {
        /* already closed */
      }
    }
    await sleep(100);
    await new Promise((resolve) => server.close(resolve));

    // Best-effort removal of the CRDT rows this spec created. These live in
    // collections owned by y-mongodb-provider / yjs-server.js, not in models.js.
    try {
      const names = [viewerTargetId, editorTargetId].filter(Boolean);
      await mongoose.connection.db
        .collection('yjs-documents')
        .deleteMany({ docName: { $in: names } });
      await mongoose.connection.db
        .collection('yjssnapshots')
        .deleteMany({ docName: { $in: names } });
    } catch (err) {
      console.warn('[ACL SPEC] yjs collection cleanup failed:', err.message);
    }

    await cleanupFixtures(
      { User, Document, HistoryEntry },
      {
        shortIds: [viewerTargetId, editorTargetId],
        userIds: [owner, viewerCollab, editorCollab].filter(Boolean).map((u) => u.id),
      }
    );
    await closeDb();
  });

  // ---------------------------------------------------------------------
  // C. Expected failure — the actual finding.
  // ---------------------------------------------------------------------

  // EXPECTED FAIL until the Yjs write-authorization fix lands —
  // AUDIT.md finding 5.3 (§7 Phase 3).
  // TODAY: the viewer's messageSync frame is applied verbatim, so the owner
  // observes the injected paragraph and this spec fails on the length check.
  expectedFail(
    'ignores document updates sent by a viewer-role collaborator',
    async () => {
      const viewer = track(await connectYjs(port, viewerTargetId, viewerCollab.token));
      await sleep(300); // let the initial SyncStep1/SyncStep2 exchange settle

      sendParagraph(viewer, 'VIEWER SHOULD NOT BE ABLE TO WRITE THIS');
      await sleep(600);

      // Observe server-side state through a fresh, independent connection:
      // whatever the server hands the owner in SyncStep2 IS the shared document.
      const observer = track(await connectYjs(port, viewerTargetId, owner.token));
      await sleep(800);

      expect(fragmentLength(observer)).toBe(0);
      expect(fragmentText(observer)).not.toContain('VIEWER SHOULD NOT BE ABLE TO WRITE');
    },
    20000
  );

  // ---------------------------------------------------------------------
  // D. Positive paths — must pass today AND after the fix.
  // ---------------------------------------------------------------------

  test(
    'accepts document updates from an editor-role collaborator',
    async () => {
      const editor = track(await connectYjs(port, editorTargetId, editorCollab.token));
      await sleep(300);

      sendParagraph(editor, 'EDITOR WRITE MUST STILL WORK');
      await sleep(400);

      const observer = track(await connectYjs(port, editorTargetId, owner.token));
      const arrived = await waitUntil(() => fragmentLength(observer) > 0, 5000);

      expect(arrived).toBe(true);
      expect(fragmentText(observer)).toContain('EDITOR WRITE MUST STILL WORK');
    },
    20000
  );

  test(
    'refuses the WebSocket upgrade when no token is supplied',
    async () => {
      // yjs-server.js:195 answers a raw `HTTP/1.1 401 Unauthorized` and destroys
      // the socket, which surfaces client-side as a handshake error.
      await expect(connectYjs(port, viewerTargetId, null)).rejects.toThrow();
    },
    20000
  );

  test(
    'refuses the WebSocket upgrade for a user with no access to the document',
    async () => {
      // A valid JWT for a real user who is neither owner nor collaborator: the
      // connect-time check at yjs-server.js:234 closes the socket with 1008.
      const stranger = await registerUser(app, 'yjs-stranger');
      const client = track(await connectYjs(port, viewerTargetId, stranger.token));

      const closed = await waitUntil(
        () => client.ws.readyState === WebSocket.CLOSED || client.ws.readyState === WebSocket.CLOSING,
        5000
      );

      expect(closed).toBe(true);
      await User.deleteOne({ _id: stranger.id });
    },
    20000
  );
});
