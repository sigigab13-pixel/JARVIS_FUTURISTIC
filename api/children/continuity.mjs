import { checkCharacterContinuity } from '../../server/continuityGuard.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = checkCharacterContinuity(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Continuity check failed.' });
  }
}
