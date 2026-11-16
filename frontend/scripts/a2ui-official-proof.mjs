/**
 * THE OFFICIAL PATH, MEASURED ON THE ROOM'S OWN CATALOGUE.
 *
 * This is not a demonstration with a catalogue written for the test. It loads
 * `design_A2UI/surface-design/catalog.json` — the document the design room already draws
 * from — into `@a2ui/web_core`'s `Catalog.fromJson`, feeds the official
 * `MessageProcessor` one of the room's own custom components with data bindings, and
 * checks that the processor accepts every message, builds the surface, and stores the
 * data the binding points at.
 *
 * WHAT IT PROVES: the protocol layer is interoperable — the catalogue, the v0.9.1
 * envelope, a custom component, and a path binding are all accepted by the official
 * client without translation.
 *
 * WHAT IT DOES NOT PROVE: that the official React renderer can draw the room's custom
 * components. Those need React implementations; the Lit renderer has them today. This
 * script is the first gate, not the last.
 *
 * Run from `frontend/`:  node scripts/a2ui-official-proof.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '../../design_A2UI/surface-design/catalog.json');
const surfaceId = 'official-proof';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const doc = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const catalog = Catalog.fromJson(doc, 'v0.9.1');
if (catalog.id !== doc.catalogId) {
  fail(`catalogue id changed: ${catalog.id} !== ${doc.catalogId}`);
}
if (!catalog.components.has('chat-tab')) {
  fail('the catalogue no longer declares chat-tab');
}

const processor = new MessageProcessor([catalog]);
const messages = [
  {
    version: 'v0.9.1',
    createSurface: {surfaceId, catalogId: catalog.id},
  },
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: 'chat-tab',
          sessionId: {path: '/session/id'},
          conversationId: {path: '/session/conversation'},
          activeTab: 'chat',
          collapsed: false,
        },
      ],
    },
  },
  {
    version: 'v0.9.1',
    updateDataModel: {
      surfaceId,
      path: '/',
      value: {session: {id: 'session-proof', conversation: 'conversation-proof'}},
    },
  },
];

const errors = processor.processMessagesWithErrors(messages);
if (errors.length > 0) {
  fail(`the official processor refused ${errors.length} message(s):\n${JSON.stringify(errors, null, 2)}`);
}

const surface = processor.getSurface(surfaceId);
if (!surface) fail('the surface was not created');
const root = surface.componentsModel.get('root');
if (!root) fail('the root component was not created');
if (root.type !== 'chat-tab') fail(`the root type is ${root.type}, not chat-tab`);
if (surface.componentsModel.size !== 1) {
  fail(`expected one component, found ${surface.componentsModel.size}`);
}
if (surface.dataModel.get('/session/id') !== 'session-proof') {
  fail(`the data model does not hold the session id: ${JSON.stringify(surface.dataModel.get('/session/id'))}`);
}
if (surface.dataModel.get('/session/conversation') !== 'conversation-proof') {
  fail(`the data model does not hold the conversation id: ${JSON.stringify(surface.dataModel.get('/session/conversation'))}`);
}
const sessionBinding = root.properties?.sessionId;
if (JSON.stringify(sessionBinding) !== JSON.stringify({path: '/session/id'})) {
  fail(`the binding was not kept as written: ${JSON.stringify(sessionBinding)}`);
}

console.log(
  JSON.stringify(
    {
      catalogue: catalog.id,
      components: catalog.components.size,
      surface: surface.id,
      root: {id: root.id, type: root.type, sessionId: sessionBinding},
      data: {
        sessionId: surface.dataModel.get('/session/id'),
        conversationId: surface.dataModel.get('/session/conversation'),
      },
      errors: 0,
    },
    null,
    2,
  ),
);
