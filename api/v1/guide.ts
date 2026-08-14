import type { IncomingMessage, ServerResponse } from 'node:http';
import { getGuide, guideSummary } from '../../src/core.js';
import { addReferralUrls, logApi, optionalParam, referralSource, requestUrl, requireGet, sendJson } from '../../src/http-json.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!requireGet(req, res)) return;
  const url = requestUrl(req);
  const slug = optionalParam(url, 'slug');
  if (!slug) {
    sendJson(res, 400, { error: 'slug is required' }, 'no-store');
    return;
  }
  const guide = getGuide(slug);
  logApi('guide', { slug, found: Boolean(guide) });
  if (!guide) {
    sendJson(res, 404, { error: 'Guide not found', slug }, 'no-store');
    return;
  }
  const source = referralSource(req);
  sendJson(res, 200, addReferralUrls({ guide: { ...guideSummary(guide), sections: guide.sections, faqs: guide.faqs, sources: guide.sources, contentMarkdown: guide.contentMarkdown } }, source));
}
