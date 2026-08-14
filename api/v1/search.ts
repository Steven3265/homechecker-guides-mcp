import type { IncomingMessage, ServerResponse } from 'node:http';
import { isWeakMatch, searchGuides } from '../../src/core.js';
import { addReferralUrls, intParam, logApi, optionalParam, referralSource, requestUrl, requireGet, sendJson } from '../../src/http-json.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  const url = requestUrl(req);
  const query = optionalParam(url, 'query');
  if (!query || query.length < 2) {
    sendJson(res, 400, { error: 'query is required and must be at least 2 characters' }, 'no-store');
    return;
  }
  if (query.length > 800) {
    sendJson(res, 400, { error: 'query must be 800 characters or fewer' }, 'no-store');
    return;
  }
  const results = searchGuides({
    query,
    jurisdiction: optionalParam(url, 'jurisdiction'),
    propertyType: optionalParam(url, 'propertyType'),
    era: optionalParam(url, 'era'),
    buyingStage: optionalParam(url, 'buyingStage'),
    cluster: optionalParam(url, 'cluster'),
    limit: intParam(url, 'limit', 5, 1, 10),
  });
  const matchStrength = results.length === 0 ? 'none' : isWeakMatch(query, results) ? 'weak' : 'strong';
  logApi('search', { queryLength: query.length, count: results.length, matchStrength, top: results[0]?.slug });
  const source = referralSource(req);
  sendJson(res, 200, addReferralUrls({
    query,
    count: results.length,
    matchStrength,
    results,
    boundary: matchStrength === 'none'
      ? 'No guide in this corpus addresses that question. Do not infer an answer from Homechecker guidance that was not returned.'
      : 'General guidance only. Results do not establish the condition, compliance, liability or legal effect of anything at a specific property.',
  }, source), 'public, max-age=60, s-maxage=300');
}
