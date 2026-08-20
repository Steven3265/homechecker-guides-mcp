import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION } from './identity.js';
import { TOOL_CONTRACTS, searchGuidanceBoundary } from './contracts.js';
import {
  buildBuyerChecklist,
  getGuide,
  guideSummary,
  guides,
  listGuides,
  renderChecklist,
  renderSearchResults,
  searchGuides,
  isWeakMatch,
  snapshot,
} from './core.js';

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
// headers, addresses and client identifiers are never logged.
function logUse(tool: string, detail: Record<string, unknown>): void {
  try {
    console.error(JSON.stringify({ evt: 'tool_call', tool, ...detail, at: new Date().toISOString() }));
  } catch {
    // Never let telemetry interfere with serving the request.
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      cacheHints: {
        'server/discover': { ttlMs: 3_600_000, cacheScope: 'public' },
        'tools/list': { ttlMs: 86_400_000, cacheScope: 'public' },
        'resources/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'resources/templates/list': { ttlMs: 3_600_000, cacheScope: 'public' },
        'resources/read': { ttlMs: 3_600_000, cacheScope: 'public' },
      },
      instructions: [
        'Use Homechecker Guides for general Australian residential-property guidance.',
        'Prefer search_guides before get_guide unless the exact slug is already known.',
        'Cite the canonical Homechecker URL returned by the tool.',
        'Keep general guidance separate from claims about a specific property.',
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
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const matches = listGuides(args).map(guideSummary);
      const payload = {
        count: matches.length,
        generatedAt: snapshot.generatedAt,
        guides: matches,
      };
      const text = matches.length
        ? matches.map((guide, index) => `${index + 1}. ${guide.title}\n${String(guide.canonicalUrl)}`).join('\n\n')
        : 'No published Homechecker guides matched those filters.';
      logUse('list_guides', { jurisdiction: args.jurisdiction, cluster: args.cluster, count: matches.length });
      return textAndStructured(payload, text);
    },
  );

  server.registerTool(
    'search_guides',
    {
      title: TOOL_CONTRACTS.search_guides.title,
      description: TOOL_CONTRACTS.search_guides.description,
      inputSchema: TOOL_CONTRACTS.search_guides.inputSchema,
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const results = searchGuides(args);
      // matchStrength lets the caller distinguish "this is the answer" from
      // "this is the closest thing we have". Without it a weak keyword hit
      // is indistinguishable from a strong one, and gets cited the same way.
      const matchStrength = results.length === 0 ? 'none' : isWeakMatch(args.query, results) ? 'weak' : 'strong';
      logUse('search_guides', {
        queryLength: args.query.length,
        jurisdiction: args.jurisdiction,
        count: results.length,
        matchStrength,
        top: results[0]?.slug,
      });
      return textAndStructured(
        {
          query: args.query,
          count: results.length,
          matchStrength,
          results,
          boundary: searchGuidanceBoundary(matchStrength),
        },
        renderSearchResults(results, args.query),
      );
    },
  );

  server.registerTool(
    'get_guide',
    {
      title: TOOL_CONTRACTS.get_guide.title,
      description: TOOL_CONTRACTS.get_guide.description,
      inputSchema: TOOL_CONTRACTS.get_guide.inputSchema,
      annotations: readOnlyAnnotations,
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
        return textAndStructured({ guide: summary }, `${guide.title}\n\n${guide.answer}\n\n${guide.canonicalUrl}`);
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
        ].filter(Boolean).join('\n\n');
        return textAndStructured(
          { guide: { ...guideSummary(guide), sections }, ...(warning ? { warning, missingSectionIds } : {}) },
          text,
        );
      }

      return textAndStructured({ guide }, guide.contentMarkdown);
    },
  );

  server.registerTool(
    'build_buyer_checklist',
    {
      title: TOOL_CONTRACTS.build_buyer_checklist.title,
      description: TOOL_CONTRACTS.build_buyer_checklist.description,
      inputSchema: TOOL_CONTRACTS.build_buyer_checklist.inputSchema,
      annotations: readOnlyAnnotations,
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
      return textAndStructured({ checklist }, renderChecklist(checklist));
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

  for (const guide of guides) {
    server.registerResource(
      `homechecker-guide-${guide.pillar ? 'hub' : guide.slug}`,
      guide.resourceUri,
      {
        title: guide.title,
        description: guide.summary,
        mimeType: 'text/markdown',
        cacheHint: { ttlMs: 3_600_000, cacheScope: 'public' },
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: guide.contentMarkdown,
          },
        ],
      }),
    );
  }

  return server;
}
