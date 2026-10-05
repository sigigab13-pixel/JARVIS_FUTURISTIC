import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendChildrenFactoryImage,
  buildChildrenFactoryImageSteps,
  markChildrenFactoryBuildComplete,
} from '../server/factory-runtime.mjs';

const character = {
  name: 'Milo',
  species: 'fox',
  color: 'orange',
  clothes: 'blue overalls',
  description: 'friendly and curious',
};

test('children factory builds deterministic executable image steps', () => {
  const steps = buildChildrenFactoryImageSteps({
    story: 'Milo learns why sharing helps everyone.',
    character,
    count: 3,
  });
  assert.equal(steps.length, 3);
  assert.equal(steps[0].executorType, 'image_generation');
  assert.equal(steps[0].sideEffect, true);
  assert.equal(steps[0].input.scene, 1);
  assert.match(steps[0].prompt, /Milo/);
  assert.match(steps[0].prompt, /blue overalls/);
});

test('children factory records completed images without duplicate scenes', () => {
  let metadata = { factory: 'children-v1', factoryBuild: { status: 'running', completedScenes: 0, totalScenes: 3 }, images: [] };
  metadata = appendChildrenFactoryImage(metadata, 1, {
    sha256: 'hash-1',
    media: { path: 'jarvis/user/one.png' },
  });
  metadata = appendChildrenFactoryImage(metadata, 1, {
    sha256: 'hash-1b',
    media: { path: 'jarvis/user/one-b.png' },
  });
  metadata = appendChildrenFactoryImage(metadata, 2, {
    sha256: 'hash-2',
    media: { path: 'jarvis/user/two.png' },
  });

  assert.equal(metadata.images.length, 2);
  assert.equal(metadata.images[0].sha256, 'hash-1b');
  assert.equal(metadata.factoryBuild.completedScenes, 2);
  assert.equal(markChildrenFactoryBuildComplete(metadata).factoryBuild.status, 'completed');
});
