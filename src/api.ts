async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { supabase, supabaseConfigured } = await import('./supabase');
  if (!supabaseConfigured || !supabase) {
    return {
      Accept: 'application/json',
      ...extra,
    };
  }
  const { data } = await supabase.auth.getSession();
  return {
    Accept: 'application/json',
    ...extra,
    ...(data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : {}),
  };
}

function describeApiError(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'description']) {
      if (typeof candidate[key] === 'string' && candidate[key].trim()) return candidate[key].trim();
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {}
  }
  return fallback;
}

export const api = {
  get: async (path: string) => {
    const response = await fetch(path, { headers: await authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(describeApiError(data?.error, `Request failed with status ${response.status}`)), { response: { data } });
    return { data };
  },
  post: async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(describeApiError(data?.error, `Request failed with status ${response.status}`)), { response: { data } });
    return { data };
  },
  patch: async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(describeApiError(data?.error, `Request failed with status ${response.status}`)), { response: { data } });
    return { data };
  },
  put: async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'PUT',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(describeApiError(data?.error, `Request failed with status ${response.status}`)), { response: { data } });
    return { data };
  },
  delete: async (path: string) => {
    const response = await fetch(path, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(describeApiError(data?.error, `Request failed with status ${response.status}`)), { response: { data } });
    return { data };
  },
};

export const image = {
  resizeIfNeeded: async (
    file: File,
    options: { maxDimension: number; maxPixels: number; quality: number; mimeType: string },
  ): Promise<{ data: string; mimeType: string }> => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      options.maxDimension / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(options.maxPixels / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, options.mimeType, options.quality));
    if (!blob) throw new Error('Could not encode image.');
    const data = await blobToBase64(blob);
    return { data, mimeType: options.mimeType };
  },
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}


export const missions = {
  list: async () => api.get('/api/missions?limit=20'),
  createImage: async (prompt: string) => api.post('/api/missions', {
    goal: 'Generate an image: ' + prompt,
    autonomy: 'execute_with_approval',
    steps: [{
      id: 'image-1',
      title: 'Generate image',
      capability: 'image',
      executorType: 'image_generation',
      sideEffect: true,
      prompt,
      priority: 50,
      maxAttempts: 3,
    }],
  }),
  requestApproval: async (id: string) => api.post('/api/missions/' + encodeURIComponent(id) + '/request-approval', {}),
  approve: async (id: string) => api.post('/api/missions/' + encodeURIComponent(id) + '/approve', {}),
  start: async (id: string) => api.post('/api/missions/' + encodeURIComponent(id) + '/start', {}),
};
