import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  buildBuyerChecklist,
  getGuide,
  guideSummary,
  guides,
  listGuides,
  renderChecklist,
  renderSearchResults,
  searchGuides,
  snapshot,
  taggedUrl,
} from './core.js';

const SERVER_NAME = 'homechecker-guides';
const SERVER_VERSION = '0.2.0';

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

// Anonymous usage telemetry, written to stdout so the platform's function
// logs capture it (no auth exists, so there is nothing identifying to log).
// Queries are truncated; logging must never break a response.
function logUse(tool: string, detail: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ evt: 'tool_call', tool, ...detail, at: new Date().toISOString() }));
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
      title: 'List Homechecker guides',
      description:
        'List the published Homechecker guide catalogue, optionally filtered by jurisdiction, guide cluster, property type, construction era, or buying stage. Returns metadata only.',
      inputSchema: {
        jurisdiction: z.string().optional().describe('Australia or a state/territory code such as VIC, NSW or QLD.'),
        cluster: z.enum(['how-to-buy', 'state-rules', 'read-building', 'shared-buildings', 'own-change']).optional(),
        propertyType: z.string().optional().describe('For example house, apartment, or townhouse or unit.'),
        era: z.string().optional().describe('For example pre-1920s, 1950s-1970s, or 2000s-on.'),
        buyingStage: z.string().optional().describe('For example research, contract review, physical inspection, ownership, or selling.'),
        includePillar: z.boolean().optional().default(false),
      },
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
        ? matches.map((guide, index) => `${index + 1}. ${guide.title}\n${taggedUrl(String(guide.canonicalUrl))}`).join('\n\n')
        : 'No published Homechecker guides matched those filters.';
      logUse('list_guides', { jurisdiction: args.jurisdiction, cluster: args.cluster, count: matches.length });
      return textAndStructured(payload, text);
    },
  );

  server.registerTool(
    'search_guides',
    {
      title: 'Search Homechecker guidance',
      description:
        'Search professionally authored Australian homebuyer guidance using a natural-language question. Use this for general property, inspection, disclosure, apartment, condition, maintenance, era and buying-process questions. It does not assess an actual property.',
      inputSchema: {
        query: z.string().min(2).max(800).describe('The homebuyer question or issue to search for.'),
        jurisdiction: z.string().optional().describe('Optional state/territory code such as VIC, NSW or QLD.'),
        propertyType: z.string().optional(),
        era: z.string().optional(),
        buyingStage: z.string().optional(),
        cluster: z.enum(['how-to-buy', 'state-rules', 'read-building', 'shared-buildings', 'own-change']).optional(),
        limit: z.number().int().min(1).max(10).optional().default(5),
      },
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      const results = searchGuides(args);
      logUse('search_guides', {
        query: args.query.slice(0, 200),
        jurisdiction: args.jurisdiction,
        count: results.length,
        top: results[0]?.slug,
      });
      return textAndStructured(
        {
          query: args.query,
          count: results.length,
          results,
          boundary:
            'Results are general guidance and do not establish the condition, compliance, liability or legal effect of anything at a specific property.',
        },
        renderSearchResults(results),
      );
    },
  );

  server.registerTool(
    'get_guide',
    {
      title: 'Get a Homechecker guide',
      description:
        'Retrieve one canonical Homechecker guide by slug. Use a slug returned by list_guides or search_guides. Returns source links, review metadata, method and limitations with the guide.',
      inputSchema: {
        slug: z.string().max(160).describe('Guide slug, for example reading-a-section-32. Use guides for the main hub.'),
        format: z.enum(['summary', 'full', 'sections']).optional().default('full'),
        sectionIds: z.array(z.string()).max(12).optional().describe('When format is sections, return only these section IDs.'),
      },
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
        return textAndStructured({ guide: summary }, `${guide.title}\n\n${guide.answer}\n\n${taggedUrl(guide.canonicalUrl)}`);
      }

      if (format === 'sections') {
        const wanted = new Set(sectionIds ?? []);
        const sections = wanted.size ? guide.sections.filter((section) => wanted.has(section.id)) : guide.sections;
        const text = [`# ${guide.title}`, ...sections.map((section) => `## ${section.heading}\n${section.markdown}`), `Canonical guide: ${taggedUrl(guide.canonicalUrl)}`].join('\n\n');
        return textAndStructured({ guide: { ...guideSummary(guide), sections } }, text);
      }

      const fullText = guide.contentMarkdown.replace(
        `Canonical guide: ${guide.canonicalUrl}`,
        `Canonical guide: ${taggedUrl(guide.canonicalUrl)}`,
      );
      return textAndStructured({ guide }, fullText);
    },
  );

  server.registerTool(
    'build_buyer_checklist',
    {
      title: 'Build a Homechecker buyer checklist',
      description:
        'Build a deterministic, sourced checklist from the Homechecker guide corpus for a buyer context. This assembles general questions and checks; it does not analyse a listing, document or actual building.',
      inputSchema: {
        jurisdiction: z.string().optional().describe('Australia or a state/territory code such as VIC, NSW or QLD.'),
        propertyType: z.string().optional().describe('For example house, apartment, or townhouse or unit.'),
        era: z.string().optional().describe('For example 1950s-1970s or 2000s-on.'),
        buyingStage: z.string().optional().describe('For example research, before offer or auction, contract review, or physical inspection.'),
        concerns: z.array(z.string().min(2).max(120)).max(10).optional().default([]),
        limit: z.number().int().min(4).max(20).optional().default(12),
      },
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
