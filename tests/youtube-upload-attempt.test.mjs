import test from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeUploadAttemptBlockReason } from '../server/youtube-upload-attempt.mjs';

test('a mission without an upload attempt can start publishing', () => {
  assert.equal(getYouTubeUploadAttemptBlockReason({ metadata: {} }), null);
  assert.equal(getYouTubeUploadAttemptBlockReason({}), null);
});

test('an in-progress upload attempt blocks a second request', () => {
  const result = getYouTubeUploadAttemptBlockReason({
    metadata: { youtubeUploadAttempt: { status: 'in_progress', id: 'attempt-1' } },
  });
  assert.equal(result.code, 'YOUTUBE_UPLOAD_ATTEMPT_IN_PROGRESS');
});

test('an uncertain upload outcome blocks automatic retry', () => {
  const result = getYouTubeUploadAttemptBlockReason({
    metadata: { youtubeUploadAttempt: { status: 'uncertain', id: 'attempt-1' } },
  });
  assert.equal(result.code, 'YOUTUBE_UPLOAD_OUTCOME_UNCERTAIN');
  assert.match(result.message, /YouTube Studio/);
});

test('a completed attempt blocks retry even if legacy video evidence is missing', () => {
  const result = getYouTubeUploadAttemptBlockReason({
    metadata: { youtubeUploadAttempt: { status: 'completed', id: 'attempt-1' } },
  });
  assert.equal(result.code, 'YOUTUBE_UPLOAD_ATTEMPT_COMPLETED');
});

test('unknown attempt states do not permanently block a mission', () => {
  assert.equal(getYouTubeUploadAttemptBlockReason({
    metadata: { youtubeUploadAttempt: { status: 'cancelled-before-upload' } },
  }), null);
});
