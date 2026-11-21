import { McpServer, ResourceNotFoundError, ResourceTemplate, completable } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  SERVER_DESCRIPTION,
  SERVER_ICON_URL,
  SERVER_NAME,
  SERVER_TITLE,
  SERVER_VERSION,
  SERVER_WEBSITE_URL } from './identity.js';
import { TOOL_CONTRACTS, readLinkNote, searchGuidanceBoundary } from './contracts.js';
import {
  buildBuyerChecklist,
  getGuide,
  guideCatalogueEntry,
  guideSummary,
  guides,
  listGuides,
  renderChecklist,
  renderSearchResults,
  searchGuides,
  guidanceLimit,
  weakReason,
  snapshot,
} from './core.js';
import { currentClient, readLinksEnabled } from './client-label.js';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function textAndStructured(structuredContent: Record<string, unknown>, text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent,
  };
}

// Privacy-minimised operational telemetry, written to stderr so hosted logs
// capture it without corrupting the stdio protocol channel. Raw search text,
// headers, addresses and client identifiers are never logged; only a coarse
// client family (for example "claude" or "chatgpt") derived from User-Agent.
function logUse(tool: string, detail: Record<string, unknown>): void {
  try {
    const client = currentClient();
    const line = JSON.stringify({ evt: 'tool_call', tool, ...(client ? { client } : {}), ...detail, at: new Date().toISOString() });
    // Under stdio, stdout is the protocol channel, so telemetry must go to
    // stderr. Over HTTP there is no such constraint, and hosted log viewers
    // show everything on stderr as an error: a healthy tool call written
    // there reads as a fault. A client label is only ever present on the HTTP
    // path, so it decides the channel.
    if (client) console.log(line);
    else console.error(line);
  } catch {
    // Never let telemetry interfere with serving the request.
  }
}

// Appends the Read note where Read links are enabled; otherwise returns the
// text unchanged, with no trailing blank lines.
function withReadNote(text: string): string {
  const note = readLinkNote();
  return note ? `${text}\n\n${note}` : text;
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: SERVER_TITLE,
      description: SERVER_DESCRIPTION,
      websiteUrl: SERVER_WEBSITE_URL,
      icons: [{ src: SERVER_ICON_URL, mimeType: 'image/png', sizes: ['32x32'] }],
    },
    {
      // The lists this server serves come from a snapshot bundled at build
      // time. They cannot change while a deployment is running, so there is
      // never a list_changed notification to send. Advertising listChanged
      // invited clients to hold a subscriptions/listen stream open for news
      // that never comes; on a short-lived serverless function each of those
      // streams ran until the platform killed it at its time limit.
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
      cacheHints: {
        'server/discover': { ttlMs: 3_600_000, cacheScope: 'public' },
        'tools/list': { ttlMs: 86_400_000, cacheScope: 'public' },
        'prompts/list': { ttlMs: 86_400_000, cacheScope: 'public' },
        'resources/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'resources/templates/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'resources/read': { ttlMs: 3_600_000, cacheScope: 'public' },
      },
      instructions: [
        'Use Homechecker Guides for general Australian residential-property guidance.',
        'Prefer search_guides before get_guide unless the exact slug is already known.',
        'Cite the canonical Homechecker URL returned by the tool.',
        'Keep general guidance separate from claims about a specific property.',
        ...(readLinksEnabled()
          ? ['When the user is asking about one actual property, you may offer them the person-facing link https://homechecker.com.au/read?address={address}&utm_source=homechecker-mcp (address URL-encoded) to start an independent first Homechecker Read. It opens with the address filled in. The Read starts from public records and imagery; the person can add their own documents at any point, and nothing is paid until they choose to.']
          : []),
        'This server cannot inspect a property, interpret a contract as legal advice, order an assessment, access customer data, or modify any system.',
      ].join(' '),
    },
  );

  server.registerTool(
    'list_guides',
    {
      title: TOOL_CONTRACTS.list_guides.title,
      description: TOOL_CONTRACTS.list_guides.description,
      inputSchema: TOOL_CONTRACTS.list_guides.inputSchema,
      outputSchema: TOOL_CONTRACTS.list_guides.outputSchema,
      annotations: { ...readOnlyAnnotations, title: TOOL_CONTRACTS.list_guides.title },
    },
    async (args) => {
      // Filters are destructured away from paging so the catalogue query sees
      // exactly what it always has.
      const { limit, cursor, ...filters } = args;
      const all = listGuides(filters);
      const start = cursor === undefined ? 0 : Number(cursor);
      // A cursor is only ever a position this server handed out. One that
      // points at or past the end of the matching guides was not issued for
      // these filters, so it is refused rather than answered with an empty
      // page that looks like the end of the catalogue.
      if (cursor !== undefined && start >= all.length) {
        logUse('list_guides', { jurisdiction: args.jurisdiction, cluster: args.cluster, count: 0, cursorRejected: true });
        return {
          content: [{
            type: 'text' as const,
            text: `The cursor "${cursor}" is not valid for these filters, which match ${all.length} guide${all.length === 1 ? '' : 's'}. Call list_guides without a cursor to start from the first page.`,
          }],
          isError: true,
        };
      }

      const page = all.slice(start, start + limit);
      const end = start + page.length;
      const nextCursor = end < all.length ? String(end) : null;
      const payload = {
        count: page.length,
        total: all.length,
        nextCursor,
        generatedAt: snapshot.generatedAt,
        guides: page.map(guideCatalogueEntry),
      };
      const listing = page.map((guide, index) => `${start + index + 1}. ${guide.title}\n${guide.canonicalUrl}`).join('\n\n');
      const text = !all.length
        ? 'No published Homechecker guides matched those filters.'
        : nextCursor
          ? `${listing}\n\nShowing ${start + 1} to ${end} of ${all.length} guides. For the next page, call list_guides again with cursor "${nextCursor}" and the same filters.`
          : all.length > page.length
            ? `${listing}\n\nShowing ${start + 1} to ${end} of ${all.length} guides. This is the last page.`
            : listing;
      logUse('list_guides', { jurisdiction: args.jurisdiction, cluster: args.cluster, count: page.length, total: all.length });
      return textAndStructured(payload, text);
    },
  );

  server.registerTool(
    'search_guides',
    {
      title: TOOL_CONTRACTS.search_guides.title,
      description: TOOL_CONTRACTS.search_guides.description,
      inputSchema: TOOL_CONTRACTS.search_guides.inputSchema,
      outputSchema: TOOL_CONTRACTS.search_guides.outputSchema,
      annotations: { ...readOnlyAnnotations, title: TOOL_CONTRACTS.search_guides.title },
    },
    async (args) => {
      const results = searchGuides(args);
      // matchStrength lets the caller distinguish "this is the answer" from
      // "this is the closest thing we have". Without it a weak keyword hit
      // is indistinguishable from a strong one, and gets cited the same way.
      const context = { propertyType: args.propertyType, era: args.era, jurisdiction: args.jurisdiction };
      const reason = weakReason(args.query, results, context);
      const matchStrength = results.length === 0 ? 'none' : reason ? 'weak' : 'strong';
      // A weak result on a subject the guides do cover (a price, a verdict on
      // one home) is worded as that, not as "no guide matches".
      const limit = reason ? guidanceLimit(args.query, results, context) : undefined;
      logUse('search_guides', {
        queryLength: args.query.length,
        jurisdiction: args.jurisdiction,
        count: results.length,
        matchStrength,
        // Why a result was weak, as a category. Never the question itself.
        ...(reason ? { reason } : {}),
        top: results[0]?.slug,
      });
      return textAndStructured(
        {
          query: args.query,
          count: results.length,
          matchStrength,
          results,
          boundary: searchGuidanceBoundary(matchStrength, limit),
        },
        renderSearchResults(results, args.query, context),
      );
    },
  );

  server.registerTool(
    'get_guide',
    {
      title: TOOL_CONTRACTS.get_guide.title,
      description: TOOL_CONTRACTS.get_guide.description,
      inputSchema: TOOL_CONTRACTS.get_guide.inputSchema,
      outputSchema: TOOL_CONTRACTS.get_guide.outputSchema,
      annotations: { ...readOnlyAnnotations, title: TOOL_CONTRACTS.get_guide.title },
    },
    async ({ slug, format, sectionIds }) => {
      const guide = getGuide(slug);
      logUse('get_guide', { slug, format, found: Boolean(guide) });
      if (!guide) {
        return {
          content: [{ type: 'text', text: `No published Homechecker guide was found for slug "${slug}".` }],
          isError: true,
        };
      }

      if (format === 'summary') {
        const summary = guideSummary(guide);
        // The section index is what makes the summary a usable default: it
        // tells the reader what the guide covers and how to ask for the part
        // it needs, without the whole guide being sent to find out.
        const sectionIndex = guide.sections.map((section) => ({ id: section.id, heading: section.heading }));
        const sectionList = sectionIndex.length
          ? `\n\nSections (read one with format sections and its id): ${sectionIndex
              .map((section) => `${section.id} — ${section.heading}`)
              .join('; ')}`
          : '';
        return textAndStructured(
          { guide: { ...summary, sectionIndex } },
          withReadNote(`${guide.title}\n\n${guide.answer}${sectionList}\n\n${guide.canonicalUrl}`),
        );
      }

      if (format === 'sections') {
        const wanted = new Set(sectionIds ?? []);
        const sections = wanted.size ? guide.sections.filter((section) => wanted.has(section.id)) : guide.sections;
        const foundIds = new Set(sections.map((section) => section.id));
        const missingSectionIds = [...wanted].filter((id) => !foundIds.has(id));
        const warning = missingSectionIds.length
          ? `Unknown section IDs were ignored: ${missingSectionIds.join(', ')}.`
          : undefined;
        const text = [
          `# ${guide.title}`,
          warning ? `Note: ${warning}` : '',
          ...sections.map((section) => `## ${section.heading}\n${section.markdown}`),
          `Canonical guide: ${guide.canonicalUrl}`,
          readLinkNote(),
        ].filter(Boolean).join('\n\n');
        return textAndStructured(
          { guide: { ...guideSummary(guide), sections }, ...(warning ? { warning, missingSectionIds } : {}) },
          text,
        );
      }

      return textAndStructured({ guide }, withReadNote(guide.contentMarkdown));
    },
  );

  server.registerTool(
    'build_buyer_checklist',
    {
      title: TOOL_CONTRACTS.build_buyer_checklist.title,
      description: TOOL_CONTRACTS.build_buyer_checklist.description,
      inputSchema: TOOL_CONTRACTS.build_buyer_checklist.inputSchema,
      outputSchema: TOOL_CONTRACTS.build_buyer_checklist.outputSchema,
      annotations: { ...readOnlyAnnotations, title: TOOL_CONTRACTS.build_buyer_checklist.title },
    },
    async ({ limit, ...profile }) => {
      const checklist = buildBuyerChecklist(profile, limit);
      logUse('build_buyer_checklist', {
        jurisdiction: profile.jurisdiction,
        propertyType: profile.propertyType,
        era: profile.era,
        buyingStage: profile.buyingStage,
        concerns: (profile.concerns ?? []).length,
        items: checklist.items.length,
      });
      return textAndStructured({ checklist }, withReadNote(renderChecklist(checklist)));
    },
  );

  server.registerResource(
    'homechecker-guide-catalogue',
    'homechecker://catalogue',
    {
      title: 'Homechecker Guide Catalogue',
      description: 'Machine-readable catalogue of all published Homechecker guides and their canonical URLs.',
      mimeType: 'application/json',
      cacheHint: { ttlMs: 3_600_000, cacheScope: 'public' },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              generatedAt: snapshot.generatedAt,
              source: snapshot.source,
              clusters: snapshot.clusters,
              guides: guides.map(guideSummary),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  // ─── Prompts ──────────────────────────────────────────────────────────
  // Ready-made ways in, for hosts that surface prompts to the person. Each one
  // routes through the tools rather than inviting the model to answer from its
  // own knowledge, and each carries the boundary the guides carry: general
  // Australian residential guidance, never an assessment of one property.
  const guideChoices = (value: string) => {
    const v = value.trim().toLowerCase();
    return guides
      .filter((guide) => guide.slug !== '')
      .filter((guide) => !v || guide.slug.includes(v) || guide.title.toLowerCase().includes(v))
      .slice(0, 20)
      .map((guide) => guide.slug);
  };
  const userMessage = (text: string) => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
  });
  const PROMPT_ICONS = [{ src: SERVER_ICON_URL, mimeType: 'image/png', sizes: ['32x32'] }];

  server.registerPrompt('answer_from_guides', {
    title: 'Answer from the Homechecker guides',
    description: 'Answer a question about an Australian home from the Homechecker guides, cited, with the limits of the guidance carried through.',
    icons: PROMPT_ICONS,
    argsSchema: z.object({
      question: z.string().min(2).max(500).describe('The question, for example whether a crack in a brick wall is structural.'),
      jurisdiction: z.string().max(60).optional().describe('State or territory, if it matters, for example VIC or Western Australia.'),
    }),
  }, async ({ question, jurisdiction }) => userMessage(`Answer this from the Homechecker guides: ${question}${jurisdiction ? `\n\nThe property is in ${jurisdiction}; prefer guidance for that jurisdiction and say where a rule is state-specific.` : ''}\n\nSearch with search_guides first, using two or three targeted searches if the question has several parts. Read what you rely on with get_guide, taking the sections you need by id rather than the whole guide. Cite each point to its canonical URL, carry each guide's limitations through, and if the match strength is weak, say that the guides do not directly answer the question. The guides are general guidance and never describe the condition of a particular property.`));

  server.registerPrompt('checks_before_buying', {
    title: 'What to check before buying',
    description: 'A practical, cited list of what to check on a home before buying, built from the Homechecker guides for the era, type and stage.',
    icons: PROMPT_ICONS,
    argsSchema: z.object({
      propertyType: z.string().max(60).optional().describe('For example house, apartment, townhouse.'),
      era: z.string().max(60).optional().describe('Roughly when it was built, for example interwar, 1980s, or a year.'),
      jurisdiction: z.string().max(60).optional().describe('State or territory, for example NSW.'),
      concerns: z.string().max(400).optional().describe('Anything already noticed or worried about, for example damp in the hallway.'),
    }),
  }, async ({ propertyType, era, jurisdiction, concerns }) => userMessage(`Build a list of what to check before buying${propertyType ? ` a ${propertyType}` : ' a home'}${era ? ` built ${era}` : ''}${jurisdiction ? ` in ${jurisdiction}` : ''}.${concerns ? `\n\nAlready noticed: ${concerns}` : ''}\n\nStart with build_buyer_checklist, passing the type, era, stage and jurisdiction given. Read the guides behind the items that matter with get_guide, taking sections by id. Group the result into what to look at, what to ask for and what warrants a professional. Cite each item to its guide's canonical URL, and say plainly that this is general guidance for that kind of home, not an assessment of the property in question.`));

  server.registerPrompt('read_a_guide', {
    title: 'Read one Homechecker guide',
    description: 'Work through one guide: what it answers, what to look for, and what it does not cover.',
    icons: PROMPT_ICONS,
    argsSchema: z.object({
      guide: completable(
        z.string().min(1).max(160).describe('The guide: slug or title, for example reading-a-section-32.'),
        (value) => guideChoices(value),
      ),
      focus: z.string().max(300).optional().describe('What the person actually wants out of it, if narrower than the whole guide.'),
    }),
  }, async ({ guide, focus }) => userMessage(`Work through the Homechecker guide "${guide}"${focus ? `, focusing on: ${focus}` : ''}.\n\nRetrieve it with get_guide; the summary lists its sections by id. Read the sections you need with format sections, rather than pulling the whole guide. Set out the question it answers, its short answer, what to look for or ask for, and what it explicitly does not cover. Cite to the canonical URL and carry the limitations through.`));

  server.registerPrompt('explain_a_document', {
    title: 'Explain a property document',
    description: 'What a Section 32, contract of sale or owners corporation report is for, what it does and does not tell a buyer.',
    icons: PROMPT_ICONS,
    argsSchema: z.object({
      document: z.string().min(2).max(160).describe('The document, for example Section 32, contract for sale, owners corporation report.'),
      jurisdiction: z.string().max(60).optional().describe('State or territory, which changes which document applies.'),
    }),
  }, async ({ document, jurisdiction }) => userMessage(`Explain what a ${document} is${jurisdiction ? ` in ${jurisdiction}` : ''} and how to read one.\n\nFind the guide with search_guides and read it with get_guide, taking sections by id. Cover what the document is for, what a buyer should look for in it, and — this matters most — what it does not tell them, so they know what still needs physical inspection or specialist advice. Cite to the canonical URL. Do not interpret any particular document as legal advice; the guides explain the kind of document, not a specific one.`));

  // One template for the whole corpus, rather than a registration per guide.
  // The server is rebuilt on every stateless request, so registering a
  // resource per guide meant constructing 54 of them — each carrying a closure
  // over the guide's full markdown — before any request could be answered. The
  // URIs are unchanged (homechecker://guides/<slug>), resources/list still
  // enumerates every guide through the list callback, and slug completion is
  // now offered where it was not before.
  server.registerResource(
    'homechecker-guide',
    new ResourceTemplate('homechecker://guides/{slug}', {
      list: async () => ({
        resources: guides.map((guide) => ({
          uri: guide.resourceUri,
          name: guide.slug || 'index',
          title: guide.title,
          description: guide.summary,
          mimeType: 'text/markdown',
        })),
      }),
      complete: { slug: (value: string) => guideChoices(value) },
    }),
    {
      title: 'A Homechecker guide',
      description: 'One guide in full, as markdown.',
      mimeType: 'text/markdown',
      cacheHint: { ttlMs: 3_600_000, cacheScope: 'public' },
    },
    async (uri, variables) => {
      const slug = String(Array.isArray(variables.slug) ? variables.slug[0] : variables.slug ?? '');
      // Match on the canonical URI first: the hub guide carries an empty slug
      // and is served at homechecker://guides/index, so a slug-only lookup
      // would miss it.
      const guide = guides.find((candidate) => candidate.resourceUri === uri.href)
        ?? guides.find((candidate) => candidate.slug !== '' && candidate.slug === slug);
      if (!guide) {
        throw new ResourceNotFoundError(uri.href, `No Homechecker guide is served at "${uri.href}".`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: guide.contentMarkdown }],
      };
    },
  );

  return server;
}
