function clean(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export function buildMerchExport({
  character = {},
  collectionName = 'JARVIS Kids Collection',
  products = ['sticker', 'tshirt', 'mug'],
  slogans = [],
} = {}) {
  const name = clean(character?.name, 'Featured Character');
  const description = clean(character?.description, 'Original JARVIS character artwork.');
  const normalizedCollection = clean(collectionName, 'JARVIS Collection');

  const allowedProducts = new Set(['sticker', 'tshirt', 'mug', 'poster', 'notebook']);
  const normalizedProducts = Array.isArray(products)
    ? products.map(value => String(value || '').trim().toLowerCase()).filter(value => allowedProducts.has(value)).slice(0, 10)
    : [];

  const normalizedSlogans = Array.isArray(slogans)
    ? slogans.map(value => String(value || '').trim()).filter(Boolean).slice(0, 10)
    : [];
  const selectedProducts = normalizedProducts.length ? normalizedProducts : ['sticker'];

  return {
    exportVersion: 'merch-manifest-v1',
    status: 'design_manifest_ready',
    collectionName: normalizedCollection,
    character: {
      name,
      description,
    },
    products: selectedProducts,
    slogans: normalizedSlogans,
    artworkBrief: {
      subject: name,
      keepCharacterConsistent: true,
      transparentBackgroundPreferred: true,
      preserveBrandSafeTypography: true,
    },
    mockupPlaceholders: selectedProducts.map(product => ({
      product,
      assetSource: 'character-artwork',
      readyForExternalProvider: true,
    })),
    note: 'This is an export manifest only. JARVIS does not call Printify or place orders from this office.',
  };
}
