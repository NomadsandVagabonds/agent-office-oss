import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { FrameParser, acceptKey, encodeFrame } from '../server/ws.mjs';

function clientFrame(payload, { opcode = 1, fin = true } = {}) {
  const body = Buffer.from(payload);
  const mask = crypto.randomBytes(4);
  let header;
  if (body.length < 126) header = Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | body.length]);
  else if (body.length < 65536) { header = Buffer.alloc(4); header[0] = (fin ? 0x80 : 0) | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(body.length, 2); }
  else { header = Buffer.alloc(10); header[0] = (fin ? 0x80 : 0) | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(body.length), 2); }
  const masked = Buffer.from(body.map((b, i) => b ^ mask[i & 3]));
  return Buffer.concat([header, mask, masked]);
}

test('accept key matches the RFC 6455 example', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
});

test('server frames use the right length encodings', () => {
  assert.equal(encodeFrame('hi')[1], 2);
  assert.equal(encodeFrame('x'.repeat(200))[1], 126);
  assert.equal(encodeFrame('x'.repeat(70000))[1], 127);
});

test('parser unmasks client frames, including ones split across chunks', () => {
  const parser = new FrameParser();
  const frames = [];
  const wire = Buffer.concat([clientFrame('{"a":1}'), clientFrame('x'.repeat(300)), clientFrame('', { opcode: 9 })]);
  for (let i = 0; i < wire.length; i += 7) parser.push(wire.subarray(i, i + 7), (f) => frames.push(f));
  assert.equal(frames.length, 3);
  assert.equal(frames[0].payload.toString(), '{"a":1}');
  assert.equal(frames[1].payload.length, 300);
  assert.equal(frames[2].opcode, 9);
});

test('parser reports fragments so the client can reassemble them', () => {
  const parser = new FrameParser();
  const frames = [];
  parser.push(Buffer.concat([clientFrame('hel', { fin: false }), clientFrame('lo', { opcode: 0 })]), (f) => frames.push(f));
  assert.deepEqual(frames.map((f) => [f.fin, f.opcode, f.payload.toString()]), [[false, 1, 'hel'], [true, 0, 'lo']]);
});

test('parser rejects unmasked and oversized frames', () => {
  assert.throws(() => new FrameParser().push(Buffer.from([0x81, 0x02, 0x68, 0x69]), () => {}), /masked/);
  assert.throws(() => new FrameParser({ maxPayload: 100 }).push(clientFrame('x'.repeat(500)), () => {}), (e) => e.code === 1009);
  assert.throws(() => new FrameParser().push(clientFrame('x'.repeat(200), { opcode: 9 }), () => {}), (e) => e.code === 1002);
});
