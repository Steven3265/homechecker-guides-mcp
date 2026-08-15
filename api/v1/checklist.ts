import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildBuyerChecklist } from '../../src/core.js';
import { addReferralUrls, intParam, logApi, optionalParam, referralSource, repeatedStringParam, requestUrl, requireGet, retagMcpReferral, sendJson } from '../../src/http-json.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  const url = requestUrl(req);
  const concerns = repeatedStringParam(url, res, 'concern', { maxItems: 10, minLength: 2, maxLength: 120 });
  if (concerns === undefined) return;
  const profile = {
    jurisdiction: optionalParam(url, 'jurisdiction'),
    propertyType: optionalParam(url, 'propertyType'),
    era: optionalParam(url, 'era'),
    buyingStage: optionalParam(url, 'buyingStage'),
    concerns,
  };
  const limit = intParam(url, res, 'limit', 12, 4, 20);
  if (limit === undefined) return;
  const checklist = buildBuyerChecklist(profile, limit);
  logApi('checklist', { jurisdiction: profile.jurisdiction, propertyType: profile.propertyType, era: profile.era, concerns: concerns.length, items: checklist.items.length });
  const source = referralSource(req);
  const attributed = addReferralUrls(checklist, source);
  attributed.guidanceBoundary = retagMcpReferral(attributed.guidanceBoundary, source);
  sendJson(res, 200, { checklist: attributed }, 'public, max-age=60, s-maxage=300');
}
