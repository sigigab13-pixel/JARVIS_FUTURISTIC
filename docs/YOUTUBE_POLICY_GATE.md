# JARVIS YouTube Policy Gate

## What it does

The policy gate is a conservative preflight layer for Children Factory and uploads routed through JARVIS YouTube Center. It:

- Screens the story, title, topic, description, and character text for a limited list of child-safety, dangerous-challenge, graphic-content, privacy, known-character/brand, and fake-engagement signals.
- Compares a proposed title/story with up to 50 recent stored Children Factory projects and blocks exact-title or likely textual near-duplicates.
- Inspects the rendered MP4 with FFprobe and requires the expected container, one H.264 video stream, the yuv420p pixel format, the selected dimensions, and a sane duration. It then reads the stored video back and confirms its SHA-256 matches the render before marking it verified.
- Recomputes SHA-256 from the stored MP4 again immediately before YouTube upload and rejects the upload if the actual bytes, storage key, rendered-video record, and verified-video record do not all match.
- Uses a Supabase RPC backed by one conditional `UPDATE` to atomically claim a mission's first upload attempt. Concurrent requests for the same mission cannot both claim it; the claim is persisted before video bytes are sent. A repeated request is blocked while an attempt is in progress, after an uncertain outcome, or after a completed attempt. Uncertain attempts must be reconciled against YouTube Studio before a retry. The SQL migration must be applied to the target Supabase project before deploying this code; the in-memory fallback is only suitable for single-process local development.
- Blocks a Children Factory draft when the automated screen finds a blocking issue or needs review, before the scene images are generated.
- Requires explicit audience and altered/synthetic-content disclosure choices at upload time.
- Forces Children Factory videos to upload as private first; the owner must inspect the processed upload in YouTube Studio before manually making it public.
- Requires eight review attestations covering rights, originality, scene-by-scene visual review, full audio review, child safety/privacy, metadata accuracy, audience classification, and AI disclosure. These are separate confirmations so checking one does not silently stand in for the other.
- Clears every review confirmation when the selected mission or media asset changes.
- Repeats the checks on the server's publish endpoint, so hiding the UI or calling the endpoint directly does not bypass the server gate.
- Saves the gate version and review evidence with the confirmed upload event.

## Important limits

This is a risk-reduction control, not a guarantee, legal opinion, or YouTube certification. Text patterns and FFprobe metadata cannot inspect the meaning of every frame, assess the safety or quality of the visuals/audio, detect every copyright-protected work, determine fair use, decide whether a video is sufficiently original, identify every policy violation, or predict YouTube's enforcement and monetization decisions. FFprobe and SHA-256 only validate technical structure and stored-byte integrity; they do not certify content compliance. The checks can also produce false positives and miss risks.

Before publishing, a human must watch the complete rendered video and verify rights for every asset and track. Keep license/permission records. Use original stories and visuals, make each episode substantively different, avoid deceptive titles/thumbnails/tags or engagement schemes, protect children's privacy, and stop when uncertain. Never tick a review box unless it is true. For serious doubts, keep the video private and review it in YouTube Studio.

## Official YouTube references

- [YouTube channel monetization policies (including inauthentic, repetitive and reused content)](https://support.google.com/youtube/answer/1311392)
- [YouTube copyright](https://support.google.com/youtube/answer/2797466)
- [YouTube Community Guidelines and child safety](https://support.google.com/youtube/answer/2801999)
- [Set a video's audience / Made for Kids](https://support.google.com/youtube/answer/9527654)
- [Disclosing altered or synthetic content](https://support.google.com/youtube/answer/14328491)
- [Spam, deceptive practices and scams](https://support.google.com/youtube/answer/2801973)
- [Advertiser-friendly content guidelines](https://support.google.com/youtube/answer/6162278)

YouTube's policies and product/API behavior can change. Recheck the official guidance and the actual upload settings in YouTube Studio before publishing.
