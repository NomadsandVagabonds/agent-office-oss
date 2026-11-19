// The WebGPU switch (engine/gpu.js, docs/BLOCKROOMS-WEBGPU.md): off unless asked for, by the address or a shell's
// stored choice; nothing of the WebGPU build is fetched or preloaded on the default path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rendererChoice, RENDERERS, DEFAULT_RENDERER, gpu } from '../public/world/engine/gpu.js';

const q = (s) => new URLSearchParams(s);

test('the renderer is WebGL unless WebGPU is asked for', () => {
  assert.equal(DEFAULT_RENDERER, 'webgl');
  assert.deepEqual([...RENDERERS], ['webgl', 'webgpu']);
  assert.equal(rendererChoice(q(''), null), 'webgl');
  assert.equal(rendererChoice(null, undefined), 'webgl');
  assert.equal(rendererChoice(q('gpu=webgpu'), null), 'webgpu');
  assert.equal(rendererChoice(q(''), 'webgpu'), 'webgpu');                  // (a shell's stored choice)
  assert.equal(rendererChoice(q('gpu=webgl'), 'webgpu'), 'webgl');           // (the address wins)
  for (const odd of ['1', 'WEBGPU', 'vulkan', '']) assert.equal(rendererChoice(q(`gpu=${odd}`), 'nonsense'), 'webgl');
  assert.equal(gpu.nodes, null, 'nothing has switched it on');
});

test('the WebGPU build is vendored at r180 beside the core it shares, and only the stage asks for it, lazily', () => {
  const core = fs.readFileSync('public/vendor/three.core.min.js', 'utf8'), webgpu = fs.readFileSync('public/vendor/three.webgpu.min.js', 'utf8');
  assert.match(core, /const t="180"/);
  assert.match(webgpu, /from"\.\/three\.core\.min\.js"/, 'it must share three.core.min.js with three.module.min.js, or objects would not cross');
  assert.match(webgpu.slice(0, 200), /SPDX-License-Identifier: MIT/);
  const stage = fs.readFileSync('public/world/engine/stage.js', 'utf8');
  assert.ok(!/^import[^\n]*three\.webgpu/m.test(stage), 'no static import of the WebGPU build');
  assert.ok(stage.includes("import('../../vendor/three.webgpu.min.js')"));
  for (const f of ['public/world/vox/material.js', 'public/world/backrooms/kit.js', 'public/world/backrooms/vhs.js', 'public/world/backrooms/kit-node.js', 'public/world/backrooms/vhs-node.js']) {
    assert.ok(!fs.readFileSync(f, 'utf8').includes('three.webgpu'), `${f} must take the WebGPU build from engine/gpu.js, not import it`);
  }
});
