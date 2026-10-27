import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedChildrenFactoryUploadAsset } from '../server/server.mjs';

const sha256 = 'a'.repeat(64);
const mediaKey = 'jarvis/user/video-render.mp4';
const renderedVideo = { mediaKey, sha256 };
const verifiedVideo = { mediaKey, sha256 };

test('upload integrity accepts bytes matching the verified render identity and digest', () => {
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/mp4',
    mediaKey,
    actualSha256: sha256,
    renderedVideo,
    verifiedVideo,
  }), true);
});

test('upload integrity rejects changed stored bytes', () => {
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/mp4',
    mediaKey,
    actualSha256: 'b'.repeat(64),
    renderedVideo,
    verifiedVideo,
  }), false);
});

test('upload integrity rejects a different media key even when hashes match', () => {
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/mp4',
    mediaKey: 'jarvis/user/other.mp4',
    actualSha256: sha256,
    renderedVideo,
    verifiedVideo,
  }), false);
});

test('upload integrity rejects disagreement between rendered and verified evidence', () => {
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/mp4',
    mediaKey,
    actualSha256: sha256,
    renderedVideo,
    verifiedVideo: { ...verifiedVideo, sha256: 'c'.repeat(64) },
  }), false);
});

test('upload integrity rejects missing hashes and non-MP4 content', () => {
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/webm',
    mediaKey,
    actualSha256: sha256,
    renderedVideo,
    verifiedVideo,
  }), false);
  assert.equal(isVerifiedChildrenFactoryUploadAsset({
    contentType: 'video/mp4',
    mediaKey,
    actualSha256: '',
    renderedVideo,
    verifiedVideo,
  }), false);
});
