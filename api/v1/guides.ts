import type { IncomingMessage, ServerResponse } from 'node:http';
import { guideSummary, listGuides, snapshot } from '../../src/core.js';
import { addReferralUrls, intParam, logApi, optionalParam, referralSource, requestUrl, requireGet, sendJson } from '../../src/http-json.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  const url = requestUrl(req);
  const limit = intParam(url, 'limit', 100, 1, 100);
  const matches = listGuides({
    jurisdiction: optionalParam(url, 'jurisdiction'),
    cluster: optionalParam(url, 'cluster'),
    propertyType: optionalParam(url, 'propertyType'),
    era: optionalParam(url, 'era'),
    buyingStage: optionalParam(url, 'buyingStage'),
    includePillar: url.searchParams.get('includePillar') === 'true',
  }).slice(0, limit).map(guideSummary);
  logApi('guides', { count: matches.length, jurisdiction: optionalParam(url, 'jurisdiction'), cluster: optionalParam(url, 'cluster') });
  const source = referralSource(req);
  sendJson(res, 200, addReferralUrls({ generatedAt: snapshot.generatedAt, count: matches.length, guides: matches }, source));
}
