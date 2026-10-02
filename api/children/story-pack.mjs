import { buildStoryPack, validateStoryPack } from '../../server/storyPack.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pack = buildStoryPack(req.body || {});
    const validation = validateStoryPack(pack);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid story pack', details: validation.errors });
    }

    return res.status(200).json(pack);
  } catch (error) {
    return res.status(400).json({
      error: error?.message || 'Could not build story pack',
    });
  }
}
