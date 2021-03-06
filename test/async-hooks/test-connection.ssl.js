'use strict';

const initHooks = require('./init-hooks');
const tick = require('./tick');
const common = require('../common');
const assert = require('assert');
const { checkInvocations } = require('./hook-checks');

if (!common.hasCrypto) {
  common.skip('missing crypto');
  return;
}

const tls = require('tls');
const Connection = process.binding('crypto').Connection;
const hooks = initHooks();
hooks.enable();

function createServerConnection(
  onhandshakestart,
  certificate = null,
  isServer = true,
  servername = 'some server',
  rejectUnauthorized
) {
  if (certificate == null) certificate = tls.createSecureContext();
  const ssl = new Connection(
    certificate.context, isServer, servername, rejectUnauthorized
  );
  if (isServer) {
    ssl.onhandshakestart = onhandshakestart;
    ssl.lastHandshakeTime = 0;
  }
  return ssl;
}

// creating first server connection
const sc1 = createServerConnection(common.mustCall(onfirstHandShake));

let as = hooks.activitiesOfTypes('CONNECTION');
assert.strictEqual(as.length, 1,
                   'one CONNECTION after first connection created');
const f1 = as[0];
assert.strictEqual(f1.type, 'CONNECTION', 'connection');
assert.strictEqual(typeof f1.uid, 'number', 'uid is a number');
assert.strictEqual(typeof f1.triggerId, 'number', 'triggerId is a number');
checkInvocations(f1, { init: 1 }, 'first connection, when first created');

// creating second server connection
const sc2 = createServerConnection(common.mustCall(onsecondHandShake));

as = hooks.activitiesOfTypes('CONNECTION');
assert.strictEqual(as.length, 2,
                   'two CONNECTIONs after second connection created');
const f2 = as[1];
assert.strictEqual(f2.type, 'CONNECTION', 'connection');
assert.strictEqual(typeof f2.uid, 'number', 'uid is a number');
assert.strictEqual(typeof f2.triggerId, 'number', 'triggerId is a number');
checkInvocations(f1, { init: 1 }, 'first connection, when second created');
checkInvocations(f2, { init: 1 }, 'second connection, when second created');

// starting the connections which results in handshake starts
sc1.start();
sc2.start();

function onfirstHandShake() {
  checkInvocations(f1, { init: 1, before: 1 },
                   'first connection, when first handshake');
  checkInvocations(f2, { init: 1 }, 'second connection, when first handshake');
}

function onsecondHandShake() {
  checkInvocations(f1, { init: 1, before: 1, after: 1 },
                   'first connection, when second handshake');
  checkInvocations(f2, { init: 1, before: 1 },
                   'second connection, when second handshake');
  tick(1E4);
}

process.on('exit', onexit);

function onexit() {
  hooks.disable();
  hooks.sanityCheck('CONNECTION');

  checkInvocations(f1, { init: 1, before: 1, after: 1 },
                   'first connection, when process exits');
  checkInvocations(f2, { init: 1, before: 1, after: 1 },
                   'second connection, when process exits');
}
