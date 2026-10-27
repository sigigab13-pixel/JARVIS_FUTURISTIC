/**
 * Fail-closed retry guard for YouTube uploads.
 *
 * YouTube upload requests cannot be made transactionally atomic with JARVIS
 * mission storage. Once an upload attempt starts, a timeout or persistence
 * failure can leave the remote outcome uncertain, so automatic retries must
 * stop until an owner reconciles the attempt.
 */
export function getYouTubeUploadAttemptBlockReason(mission) {
  const attempt = mission?.metadata?.youtubeUploadAttempt;
  if (!attempt || typeof attempt !== 'object') return null;
  if (attempt.status === 'in_progress') {
    return {
      code: 'YOUTUBE_UPLOAD_ATTEMPT_IN_PROGRESS',
      message: 'A YouTube upload attempt is already in progress. Do not retry until its status is checked.',
    };
  }
  if (attempt.status === 'uncertain') {
    return {
      code: 'YOUTUBE_UPLOAD_OUTCOME_UNCERTAIN',
      message: 'The previous YouTube upload outcome is uncertain. Check YouTube Studio and reconcile this attempt before retrying.',
    };
  }
  if (attempt.status === 'completed') {
    return {
      code: 'YOUTUBE_UPLOAD_ATTEMPT_COMPLETED',
      message: 'This mission already has a completed YouTube upload attempt. Use the saved upload evidence instead of retrying.',
    };
  }
  return null;
}
