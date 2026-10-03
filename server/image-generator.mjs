import { InferenceClient } from '@huggingface/inference';

export const HF_IMAGE_MODELS = [
  'black-forest-labs/FLUX.1-schnell',
  'black-forest-labs/FLUX.1-Krea-dev',
  'black-forest-labs/FLUX.1-dev',
];

export const HF_IMAGE_EDIT_MODELS = [
  'black-forest-labs/FLUX.2-klein-9B',
  'black-forest-labs/FLUX.1-Kontext-dev',
  'black-forest-labs/FLUX.2-dev',
];

export const HF_IMAGE_PROVIDERS = ['auto'];

function isImageBlob(value) {
  return Boolean(value && typeof value.arrayBuffer === 'function');
}

export async function generateHuggingFaceImage(prompt, inputImage = null) {
  const token = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
  if (!token) {
    throw Object.assign(new Error('Hugging Face image generation is not configured.'), { statusCode: 503, code: 'IMAGE_PROVIDER_NOT_CONFIGURED' });
  }

  const client = new InferenceClient(token);
  const errors = [];

  if (!inputImage) {
    for (const model of HF_IMAGE_MODELS) {
      try {
        const result = await client.textToImage({
          model,
          inputs: prompt,
          provider: 'auto',
        });
        if (!isImageBlob(result)) throw new Error('Hugging Face returned an invalid image payload.');
        return result;
      } catch (error) {
        const status = Number(error?.httpResponse?.status || error?.response?.status || error?.status || error?.statusCode || 0);
        const body = error?.httpResponse?.body || error?.response?.body || error?.data;
        const detail = typeof body === 'string' ? body : body?.error || body?.message || '';
        const requestId = error?.httpResponse?.requestId || error?.response?.requestId || '';
        errors.push(
          `${model} via auto${status ? ` [${status}]` : ''}${requestId ? ` {${requestId}}` : ''}: ${error instanceof Error ? error.message : String(error)}${detail ? ` | ${detail}` : ''}`
        );
      }
    }
  } else {
    const binary = Buffer.from(String(inputImage.data || ''), 'base64');
    if (!binary.length) {
      throw Object.assign(new Error('The reference image is empty.'), { statusCode: 400, code: 'IMAGE_REFERENCE_EMPTY' });
    }
    const blob = new Blob([binary], { type: String(inputImage.mimeType || 'image/jpeg') });

    for (const model of HF_IMAGE_EDIT_MODELS) {
      try {
        const result = await client.imageToImage({
          model,
          inputs: blob,
          parameters: { prompt },
          provider: 'auto',
        });
        if (!isImageBlob(result)) throw new Error('Hugging Face returned an invalid edited-image payload.');
        return result;
      } catch (error) {
        const status = Number(error?.httpResponse?.status || error?.response?.status || error?.status || error?.statusCode || 0);
        const body = error?.httpResponse?.body || error?.response?.body || error?.data;
        const detail = typeof body === 'string' ? body : body?.error || body?.message || '';
        const requestId = error?.httpResponse?.requestId || error?.response?.requestId || '';
        errors.push(
          `${model} image-to-image via auto${status ? ` [${status}]` : ''}${requestId ? ` {${requestId}}` : ''}: ${error instanceof Error ? error.message : String(error)}${detail ? ` | ${detail}` : ''}`
        );
      }
    }
  }

  const summary = errors.slice(-6).join(' | ');
  throw Object.assign(
    new Error(summary || 'No Hugging Face image provider is currently available.'),
    { statusCode: 502, code: 'IMAGE_PROVIDER_UNAVAILABLE' },
  );
}
