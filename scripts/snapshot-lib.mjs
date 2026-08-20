export function buildSnapshot(registry, options = {}) {
  const { publishedGuides, guideClusters } = registry
  const BASE_URL = options.baseUrl ?? 'https://homechecker.com.au'
  const generatedAt = options.generatedAt ?? new Date().toISOString()

  const decodeEntities = (value) => value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')

  function htmlToMarkdown(html = '') {
    let s = html
    s = s.replace(/<a\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const clean = stripTags(label).trim()
      const url = href.startsWith('/') ? `${BASE_URL}${href}` : href
      return clean ? `[${clean}](${url})` : url
    })
    s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    s = s.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    s = s.replace(/<br\s*\/?\s*>/gi, '\n')
    s = stripTags(s)
    return decodeEntities(s).replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
  }

  function stripTags(value = '') {
    return value.replace(/<[^>]+>/g, '')
  }

  function blockToMarkdown(block) {
    switch (block.type) {
      case 'p': return htmlToMarkdown(block.html)
      case 'h2': return `## ${block.text}`
      case 'h3': return `### ${block.text}`
      case 'ul': return block.items.map((item) => `- ${htmlToMarkdown(item)}`).join('\n')
      case 'ol': return block.items.map((item, index) => `${index + 1}. ${htmlToMarkdown(item)}`).join('\n')
      case 'table': {
        const caption = block.caption ? `**${block.caption}**\n\n` : ''
        const head = `| ${block.headers.join(' | ')} |`
        const rule = `| ${block.headers.map(() => '---').join(' | ')} |`
        const rows = block.rows.map((row) => `| ${row.map((cell) => htmlToMarkdown(cell)).join(' | ')} |`).join('\n')
        return `${caption}${head}\n${rule}\n${rows}`
      }
      case 'callout': return `> ${block.tone === 'warn' ? 'Important: ' : 'Note: '}${htmlToMarkdown(block.html)}`
      case 'image': return block.caption ? `_[Illustration: ${block.alt}. ${block.caption}]_` : `_[Illustration: ${block.alt}]_`
      case 'plate': {
        const items = block.items.map((item) => `- **${item.label}:** ${item.detail}`).join('\n')
        return `### ${block.title}\n${items}${block.footer ? `\n\n_${block.footer}_` : ''}`
      }
      case 'tool': return `_[Interactive Homechecker tool on the canonical web guide: ${block.tool}]_`
      default: return ''
    }
  }

  const clusterBySlug = new Map()
  for (const cluster of guideClusters) {
    for (const slug of cluster.slugs) clusterBySlug.set(slug, cluster)
  }

  const TOPIC_PATTERNS = {
    'auction': /\bauction|bidding|bidder\b/i,
    'building inspection': /building (?:and pest )?inspection|pre-purchase report|inspector/i,
    'contract and disclosure': /section 32|vendor statement|contract for sale|seller disclosure|form 2|conveyanc/i,
    'cooling-off': /cooling[- ]off/i,
    'apartments and strata': /apartment|strata|owners corporation|body corporate|common property/i,
    'maintenance': /maintenance|maintain|preventative/i,
    'renovation and alterations': /renovat|extension|alteration|permit/i,
    'heritage and planning': /heritage|planning overlay|planning control|zone\b/i,
    'cracking and movement': /crack|movement|settlement|subsidence/i,
    'damp and moisture': /damp|moisture|mould|water ingress|leak/i,
    'roofing': /roof|gutter|downpipe/i,
    'drainage': /drainage|stormwater|surface water/i,
    'pests and termites': /termite|timber pest|borer/i,
    'insurance': /insurance|insurability|premium|claim/i,
    'hazardous materials': /asbestos|lead paint|hazardous material|silica/i,
    'records and evidence': /record|evidence|document|certificate|minutes|report/i,
    'cost and budgeting': /cost|price|budget|capital|allowance|fund/i,
    'weather and resilience': /weather|storm|bushfire|flood|heat|cyclone/i,
    'construction era': /pre-?1920|1920|1930|1940|1950|1960|1970|1980|1990|2000|era|decade/i,
    'construction type': /weatherboard|brick veneer|double brick|masonry|timber/i,
    'selling': /selling|seller|vendor/i,
  }

  function inferTopics(text) {
    return Object.entries(TOPIC_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic)
  }

  function inferPropertyTypes(_text, slug, clusterId) {
    if (clusterId === 'shared-buildings' || /apartment|strata|owners-corporation/.test(slug)) {
      return ['apartment']
    }
    if (/townhouse|villa/.test(slug)) return ['townhouse or unit']
    if (
      /weatherboard|brick-veneer|double-brick|period-homes|interwar-homes|postwar-homes|homes-1980s|modern-homes|red-flags-by-era|what-your-home-needs-by-decade/.test(slug)
    ) return ['house']
    return ['all residential property']
  }

  function inferEras(slug, text) {
    const eras = []
    if (/period-homes-pre-1920s|pre[- ]?1920/i.test(`${slug} ${text}`)) eras.push('pre-1920s')
    if (/interwar|1920s|1930s|1940s/i.test(`${slug} ${text}`)) eras.push('1920s-1940s')
    if (/postwar|1950s|1960s|1970s/i.test(`${slug} ${text}`)) eras.push('1950s-1970s')
    if (/1980s|1990s/i.test(`${slug} ${text}`)) eras.push('1980s-1990s')
    if (/modern|2000s|2010s|2020s/i.test(`${slug} ${text}`)) eras.push('2000s-on')
    if (/red-flags-by-era|what-your-home-needs-by-decade/i.test(slug)) return ['all eras']
    return [...new Set(eras)]
  }

  function inferBuyingStages(clusterId, text) {
    const stages = new Set()
    if (clusterId === 'how-to-buy' || /before (?:you )?(?:buy|bid|sign)|due diligence|offer|auction/i.test(text)) {
      stages.add('research')
      stages.add('before offer or auction')
    }
    if (/contract|section 32|form 2|conveyanc|cooling[- ]off/i.test(text)) stages.add('contract review')
    if (/inspection|inspector|report/i.test(text)) stages.add('physical inspection')
    if (clusterId === 'own-change') stages.add('ownership')
    if (/selling|seller|vendor/i.test(text)) stages.add('selling')
    if (!stages.size) stages.add('general guidance')
    return [...stages]
  }

  function extractSections(body) {
    const sections = []
    let current = { id: 'opening', heading: 'Opening', markdown: [] }
    for (const block of body) {
      if (block.type === 'h2') {
        if (current.markdown.length) sections.push({ ...current, markdown: current.markdown.join('\n\n') })
        current = { id: block.id, heading: block.text, markdown: [] }
        continue
      }
      const md = blockToMarkdown(block)
      if (md) current.markdown.push(md)
    }
    if (current.markdown.length) sections.push({ ...current, markdown: current.markdown.join('\n\n') })
    return sections
  }

  function extractChecklistCandidates(guide) {
    const candidates = []
    let heading = ''
    const push = (text, source) => {
      const clean = htmlToMarkdown(text).replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim()
      if (clean.length >= 18 && clean.length <= 320) candidates.push({ text: clean, section: source || heading || 'Guide' })
    }
    for (const block of guide.body) {
      if (block.type === 'h2' || block.type === 'h3') heading = block.text
      if (block.type === 'ol' || block.type === 'ul') for (const item of block.items) push(item, heading)
      if (block.type === 'plate') for (const item of block.items) push(`${item.label}: ${item.detail}`, block.title)
      if (block.type === 'table') {
        for (const row of block.rows) {
          const cells = row.map((cell) => htmlToMarkdown(cell))
          const actionCell = [...cells].reverse().find((cell) => /ask|check|confirm|verify|review|compare|find|question|look|inspect|establish/i.test(cell))
          if (actionCell) {
            const label = cells[0] && cells[0] !== actionCell ? `${cells[0]}: ` : ''
            push(`${label}${actionCell}`, block.caption || heading)
          }
        }
      }
    }
    const seen = new Set()
    return candidates.filter((item) => {
      const key = item.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const guides = publishedGuides.map((guide) => {
    const cluster = guide.pillar ? { id: 'hub', label: 'Guide hub', chip: 'Overview', blurb: 'The complete Homechecker guide system.' } : clusterBySlug.get(guide.slug)
    const canonicalUrl = guide.pillar ? `${BASE_URL}/guides` : `${BASE_URL}/guides/${guide.slug}`
    const resourceUri = guide.pillar ? 'homechecker://guides/index' : `homechecker://guides/${guide.slug}`
    const sections = extractSections(guide.body)
    const contentMarkdown = [
      `# ${guide.title}`,
      guide.answer,
      guide.researchNote ? `## Research note\n${htmlToMarkdown(guide.researchNote)}` : '',
      sections.map((s) => `## ${s.heading}\n${s.markdown.replace(/^## [^\n]+\n?/, '')}`).join('\n\n'),
      guide.faqs.length ? `## Frequently asked questions\n${guide.faqs.map((faq) => `### ${faq.q}\n${htmlToMarkdown(faq.a)}`).join('\n\n')}` : '',
      guide.methodology ? `## Method\n${htmlToMarkdown(guide.methodology)}` : '',
      guide.limitations ? `## Limitations\n${htmlToMarkdown(guide.limitations)}` : '',
      guide.sources?.length ? `## Sources\n${guide.sources.map((s) => `- [${s.title}](${s.url}) — ${s.publisher}; accessed ${s.accessed}`).join('\n')}` : '',
      `Canonical guide: ${canonicalUrl}`,
    ].filter(Boolean).join('\n\n')
    const searchable = [guide.slug, guide.question, guide.title, guide.dek, guide.answer, contentMarkdown].join(' ')
    const metadataSearchable = [
      guide.slug,
      guide.question,
      guide.title,
      guide.dek,
      guide.answer,
      cluster?.label ?? '',
      ...sections.map((section) => section.heading),
    ].join(' ')
    return {
      slug: guide.slug,
      pillar: Boolean(guide.pillar),
      resourceUri,
      canonicalUrl,
      question: guide.question,
      title: guide.title,
      summary: guide.dek,
      answer: guide.answer,
      updated: guide.updated,
      publishedAt: guide.publishedAt ?? null,
      updatedAt: guide.updatedAt ?? guide.updated,
      reviewedAt: guide.reviewedAt ?? null,
      reviewDue: guide.reviewDue ?? null,
      jurisdiction: guide.jurisdiction ?? ['Australia'],
      reviewedBy: guide.reviewedBy ?? null,
      methodology: guide.methodology ?? null,
      limitations: guide.limitations ?? null,
      researchNote: guide.researchNote ? htmlToMarkdown(guide.researchNote) : null,
      wordCount: Number.isInteger(guide.wordCount) ? guide.wordCount : null,
      readingTimeMin: guide.readingTimeMin,
      cluster: cluster ? { id: cluster.id, label: cluster.label, chip: cluster.chip, blurb: cluster.blurb } : null,
      topics: inferTopics(metadataSearchable),
      propertyTypes: inferPropertyTypes(metadataSearchable, guide.slug, cluster?.id),
      eras: inferEras(guide.slug, `${guide.slug} ${guide.title} ${guide.question}`),
      buyingStages: inferBuyingStages(cluster?.id, metadataSearchable),
      sections,
      faqs: guide.faqs.map((faq) => ({ question: faq.q, answer: htmlToMarkdown(faq.a) })),
      checklistCandidates: extractChecklistCandidates(guide),
      sources: (guide.sources ?? []).map((s) => ({ ...s })),
      // Portal authoring uses '' to mean the /guides pillar. Preserve that
      // relationship in the machine snapshot using the stable alias accepted
      // by getGuide(), rather than silently dropping it.
      related: [...new Set((guide.related ?? []).map((slug) => slug.trim() || 'guides'))],
      contentMarkdown,
    }
  })

  const output = {
    schemaVersion: 1,
    generatedAt,
    source: {
      name: 'Homechecker guide registry',
      origin: options.origin ?? 'Moyne Ross portal content/guides/_registry.ts',
      baseUrl: BASE_URL,
      contentCount: guides.length,
      spokeCount: guides.filter((g) => !g.pillar).length,
      latestUpdated: guides.map((g) => g.updatedAt).sort().at(-1),
      readingTimeMethod: options.readingTimeMethod ?? null,
    },
    clusters: guideClusters.map(({ id, label, chip, blurb, slugs }) => ({ id, label, chip, blurb, slugs })),
    guides,
  }

  return output
}
