const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.businessStatus',
  'places.websiteUri',
  'places.primaryType',
  'places.types',
  'nextPageToken'
].join(',');

const DEFAULT_AREAS = [
  '川口市',
  '東川口',
  '鳩ヶ谷',
  '蕨市',
  '戸田市',
  '草加市',
  '越谷市',
  'さいたま市南区',
  '東京都北区',
  '東京都足立区'
];

const DEFAULT_CATEGORIES = [
  'ネイルサロン',
  'アイラッシュサロン',
  'アイブロウサロン',
  '美容室',
  'ピラティス',
  'ヨガ',
  'パーソナルジム',
  'フォトスタジオ',
  'レンタルスペース',
  'カフェ',
  '整体',
  'リラクゼーション'
];

export function buildDailyQueryPlan({ dateText, maxQueries = 15 } = {}) {
  const seed = Number(String(dateText || '').replace(/\D/g, '').slice(-4)) || 0;
  const pairs = [];
  for (let i = 0; i < DEFAULT_AREAS.length; i += 1) {
    for (let j = 0; j < DEFAULT_CATEGORIES.length; j += 1) {
      pairs.push({ area: DEFAULT_AREAS[i], category: DEFAULT_CATEGORIES[j], query: `${DEFAULT_AREAS[i]} ${DEFAULT_CATEGORIES[j]} 公式` });
    }
  }
  return pairs
    .map((item, index) => ({ item, rank: (index + seed) % pairs.length }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, maxQueries)
    .map(({ item }) => item);
}

export async function discoverPlacesWithGooglePlaces({
  apiKey,
  dateText,
  maxProviderRequests = 30,
  fetchImpl = fetch,
  mock = false
} = {}) {
  const summary = {
    provider: 'google_places',
    apiKeyConfigured: Boolean(apiKey),
    queryCount: 0,
    providerRequestCount: 0,
    rawPlaceCount: 0,
    uniquePlaceCount: 0,
    closedExcludedCount: 0,
    websiteMissingCount: 0,
    duplicatePlaceExcludedCount: 0,
    places: [],
    errorCode: ''
  };
  if (!apiKey && !mock) {
    summary.errorCode = 'candidate_discovery_provider_unconfigured';
    return summary;
  }

  const queries = buildDailyQueryPlan({ dateText, maxQueries: 15 });
  summary.queryCount = queries.length;
  const seen = new Set();
  for (const query of queries) {
    let pageToken = '';
    for (let page = 0; page < 2; page += 1) {
      if (summary.providerRequestCount >= maxProviderRequests) break;
      const response = mock
        ? mockTextSearch(query, page)
        : await requestTextSearchWithSingleRetry({ apiKey, query: query.query, pageToken, fetchImpl, summary, maxProviderRequests });
      if (mock) summary.providerRequestCount += 1;
      const places = Array.isArray(response.places) ? response.places : [];
      summary.rawPlaceCount += places.length;
      for (const place of places) {
        const id = String(place.id || '').trim();
        if (!id || seen.has(id)) {
          summary.duplicatePlaceExcludedCount += 1;
          continue;
        }
        seen.add(id);
        if (place.businessStatus === 'CLOSED_PERMANENTLY' || place.businessStatus === 'CLOSED_TEMPORARILY' || place.businessStatus === 'FUTURE_OPENING') {
          summary.closedExcludedCount += 1;
          continue;
        }
        if (!String(place.websiteUri || '').trim()) {
          summary.websiteMissingCount += 1;
          continue;
        }
        summary.places.push({
          id,
          name: String(place.displayName && place.displayName.text || '').trim(),
          formattedAddress: String(place.formattedAddress || '').trim(),
          websiteUri: String(place.websiteUri || '').trim(),
          primaryType: String(place.primaryType || '').trim(),
          types: Array.isArray(place.types) ? place.types : [],
          area: query.area,
          category: query.category
        });
      }
      pageToken = String(response.nextPageToken || '').trim();
      if (!pageToken) break;
    }
  }
  summary.uniquePlaceCount = summary.places.length;
  return summary;
}

async function requestTextSearch({ apiKey, query, pageToken, fetchImpl }) {
  const body = {
    textQuery: query,
    languageCode: 'ja',
    regionCode: 'JP',
    pageSize: 20,
    includePureServiceAreaBusinesses: false
  };
  if (pageToken) body.pageToken = pageToken;
  const response = await fetchImpl(TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify(body)
  });
  if (response.status === 429 && response.headers && response.headers.get('retry-after')) {
    throw new Error('google_places_rate_limited');
  }
  if (!response.ok) throw new Error(`google_places_http_${response.status}`);
  return await response.json();
}

async function requestTextSearchWithSingleRetry({ apiKey, query, pageToken, fetchImpl, summary, maxProviderRequests }) {
  try {
    const response = await requestTextSearch({ apiKey, query, pageToken, fetchImpl });
    summary.providerRequestCount += 1;
    return response;
  } catch (error) {
    summary.providerRequestCount += 1;
    if (String(error && error.message || '') !== 'google_places_rate_limited' || summary.providerRequestCount >= maxProviderRequests) {
      throw error;
    }
    const response = await requestTextSearch({ apiKey, query, pageToken, fetchImpl });
    summary.providerRequestCount += 1;
    return response;
  }
}

function mockTextSearch(query, page) {
  const base = page * 20;
  const places = Array.from({ length: 20 }, (_, index) => {
    const n = base + index + 1;
    const host = `mock-${query.area}-${query.category}-${n}.example`.replace(/[^\w.-]/g, '-').toLowerCase();
    return {
      id: `place-${query.area}-${query.category}-${n}`,
      displayName: { text: `Mock ${query.category} ${n}` },
      formattedAddress: `${query.area} mock address`,
      businessStatus: n % 37 === 0 ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL',
      websiteUri: n % 11 === 0 ? '' : `https://${host}/`,
      primaryType: 'store',
      types: ['point_of_interest', 'establishment']
    };
  });
  return { places, nextPageToken: page === 0 ? `next-${query.area}-${query.category}` : '' };
}

export const GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK = FIELD_MASK;
