import type { IncomingMessage, ServerResponse } from 'node:http';
import { guideSummary, listGuides, snapshot } from '../../src/core.js';
import { addReferralUrls, booleanParam, enumParam, intParam, logApi, optionalParam, referralSource, requestUrl, requireGet, sendJson } from '../../src/http-json.js';
import { CLUSTER_IDS } from '../../src/contracts.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  const url = requestUrl(req);
  const limit = intParam(url, res, 'limit', 100, 1, 100);
  if (limit === undefined) return;
  const cluster = enumParam(url, res, 'cluster', CLUSTER_IDS);
  if (cluster === null) return;
  const includePillar = booleanParam(url, res, 'includePillar', false);
  if (includePillar === undefined) return;
  const matches = listGuides({
    jurisdiction: optionalParam(url, 'jurisdiction'),
    cluster,
    propertyType: optionalParam(url, 'propertyType'),
    era: optionalParam(url, 'era'),
    buyingStage: optionalParam(url, 'buyingStage'),
    includePillar,
  }).slice(0, limit).map(guideSummary);
  logApi('guides', { count: matches.length, jurisdiction: optionalParam(url, 'jurisdiction'), cluster });
  const source = referralSource(req);
  sendJson(res, 200, addReferralUrls({ generatedAt: snapshot.generatedAt, count: matches.length, guides: matches }, source));
}
