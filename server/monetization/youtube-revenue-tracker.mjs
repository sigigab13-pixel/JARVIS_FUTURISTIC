const VALID_PLATFORMS = new Set(['youtube', 'tiktok', 'facebook']);

function asFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asNonNegativeNumber(value, field) {
  const number = asFiniteNumber(value, NaN);
  if (!Number.isFinite(number) || number < 0) {
    throw Object.assign(new Error(field + ' must be a non-negative number.'), { statusCode: 400 });
  }
  return number;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

export function estimatePlatformRevenue({
  platform = 'youtube',
  views = 0,
  ratePerThousandViews = 0,
  currency = 'USD',
} = {}) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  if (!VALID_PLATFORMS.has(normalizedPlatform)) {
    throw Object.assign(new Error('Unsupported monetization platform.'), { statusCode: 400 });
  }

  const normalizedViews = asNonNegativeNumber(views, 'views');
  const normalizedRate = asNonNegativeNumber(ratePerThousandViews, 'ratePerThousandViews');
  const normalizedCurrency = String(currency || 'USD').trim().toUpperCase() || 'USD';

  return {
    platform: normalizedPlatform,
    views: normalizedViews,
    ratePerThousandViews: normalizedRate,
    estimatedRevenue: roundCurrency((normalizedViews / 1000) * normalizedRate),
    currency: normalizedCurrency,
    estimateBasis: 'user-supplied-rate',
    disclaimer: 'This is a planning estimate, not a platform payout guarantee.',
  };
}

export function buildYouTubeRevenueSnapshot({
  analytics = {},
  startDate = null,
  endDate = null,
  ratePerThousandViews = 0,
  currency = 'USD',
} = {}) {
  const headers = Array.isArray(analytics?.columnHeaders) ? analytics.columnHeaders : [];
  const rows = Array.isArray(analytics?.rows) ? analytics.rows : [];

  const indexByName = new Map(
    headers.map((header, index) => [
      String(header?.name || header || '').trim().toLowerCase(),
      index,
    ]),
  );

  const valueAt = (row, name) => {
    const index = indexByName.get(name);
    return index === undefined ? 0 : asFiniteNumber(row?.[index], 0);
  };

  const totals = rows.reduce((accumulator, row) => ({
    views: accumulator.views + Math.max(0, valueAt(row, 'views')),
    estimatedMinutesWatched: accumulator.estimatedMinutesWatched + Math.max(0, valueAt(row, 'estimatedminuteswatched')),
    likes: accumulator.likes + Math.max(0, valueAt(row, 'likes')),
    comments: accumulator.comments + Math.max(0, valueAt(row, 'comments')),
    subscribersGained: accumulator.subscribersGained + Math.max(0, valueAt(row, 'subscribersgained')),
    subscribersLost: accumulator.subscribersLost + Math.max(0, valueAt(row, 'subscriberslost')),
  }), {
    views: 0,
    estimatedMinutesWatched: 0,
    likes: 0,
    comments: 0,
    subscribersGained: 0,
    subscribersLost: 0,
  });

  const revenue = estimatePlatformRevenue({
    platform: 'youtube',
    views: totals.views,
    ratePerThousandViews,
    currency,
  });

  return {
    ...revenue,
    startDate: startDate || null,
    endDate: endDate || null,
    daysReturned: rows.length,
    estimatedMinutesWatched: roundCurrency(totals.estimatedMinutesWatched),
    likes: totals.likes,
    comments: totals.comments,
    subscribersGained: totals.subscribersGained,
    subscribersLost: totals.subscribersLost,
    netSubscribers: totals.subscribersGained - totals.subscribersLost,
  };
}
