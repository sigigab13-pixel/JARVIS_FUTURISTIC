function fail(reason, details = {}) {
  return { passed: false, reason, details };
}

export function validateChildrenFactoryVideo({
  videoBytes = 0,
  width = 0,
  height = 0,
  durationSeconds = 0,
  sourceImageCount = 0,
  expectedImageCount = 0,
  hasVideoStream = false,
  hasAudioStream = false,
  narrationRequested = false,
  provider = '',
  mediaKey = '',
} = {}) {
  const checks = [];
  if (Number(videoBytes) <= 0) return fail('Final video file is empty.');
  checks.push('non_empty_file');

  if (!hasVideoStream) return fail('Final video does not contain a video stream.');
  checks.push('video_stream_present');

  if (Number(width) <= 0 || Number(height) <= 0) return fail('Final video dimensions are invalid.');
  checks.push('valid_dimensions');

  const ratio = Number(width) / Number(height);
  if (!(ratio > 1.70 && ratio < 1.80)) return fail('Final video is not a 16:9-compatible output.');
  checks.push('aspect_ratio_16_9');

  if (Number(durationSeconds) < Math.max(3, Number(expectedImageCount || 1) * 3)) {
    return fail('Final video duration is shorter than the minimum expected episode duration.', {
      durationSeconds,
      expectedMinimumSeconds: Math.max(3, Number(expectedImageCount || 1) * 3),
    });
  }
  checks.push('duration_minimum');

  if (Number(sourceImageCount) !== Number(expectedImageCount)) {
    return fail('Final video does not account for every generated story scene.', {
      sourceImageCount,
      expectedImageCount,
    });
  }
  checks.push('all_scenes_present');

  if (narrationRequested && !hasAudioStream) {
    return fail('Narration was requested but the final video contains no audio stream.');
  }
  if (narrationRequested) checks.push('narration_audio_present');

  if (!String(provider || '').trim()) return fail('Video provider identity is missing.');
  checks.push('provider_recorded');

  if (!String(mediaKey || '').trim()) return fail('Stored media key is missing.');
  checks.push('stored_media_reference');

  return {
    passed: true,
    checks,
    summary: 'Children Factory video passed deterministic media and continuity QA.',
    ratio: Number(ratio.toFixed(4)),
  };
}
