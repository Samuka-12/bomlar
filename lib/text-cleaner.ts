import he from 'he';

const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\u20E3\u25AA\u25AB\u2B50\u2705\u2714\u2728\u26A0\u274C\u2757\u2753\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

/**
 * Remove emojis de qualquer string e limpa espaços residuais.
 */
export function removeEmojis(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(EMOJI_REGEX, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // caracteres invisíveis
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Limpa o título do produto: remove emojis, artefatos e formata com elegância.
 */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return '';
  const decoded = he.decode(title);
  const withoutEmojis = removeEmojis(decoded);
  return withoutEmojis
    .replace(/^[\s\-–—:*•|]+/, '')
    .replace(/[\s\-–—:*•|]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type DescriptionSection = {
  title?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type FormattedDescription = {
  intro: string;
  sections: DescriptionSection[];
  cleanText: string;
};

/**
 * Higieniza e estrutura a descrição do produto de forma profissional:
 * - Sem emojis
 * - Parágrafos objetivos e legíveis
 * - Listas para especificações e características quando presentes
 */
export function formatDescription(rawDescription: string | null | undefined): FormattedDescription {
  if (!rawDescription) {
    return { intro: '', sections: [], cleanText: '' };
  }

  // 1. Decodificar entidades HTML e remover emojis
  let text = he.decode(rawDescription);
  text = removeEmojis(text);

  // 2. Normalizar quebras de linha e separadores de tópicos
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '') // remove outras tags HTML residuais
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Normalizar marcadores de tópicos comuns
  const sectionHeaders = [
    'ESPECIFICAÇÕES',
    'CARACTERÍSTICAS',
    'BENEFÍCIOS',
    'DIFERENCIAIS',
    'MODO DE USO',
    'COMO USAR',
    'CONTEÚDO DA EMBALAGEM',
    'ITENS INCLUSOS',
    'DIMENSÕES',
    'CUIDADOS',
    'MATERIAL',
    'DETALHES',
  ];

  const headerPattern = new RegExp(`(^|\\n|\\.\\s+)(${sectionHeaders.join('|')}):?`, 'gi');
  text = text.replace(headerPattern, '\n\n### $2\n');

  // Separar em blocos
  const rawBlocks = text
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);

  let intro = '';
  const sections: DescriptionSection[] = [];
  let currentSection: DescriptionSection | null = null;

  for (const block of rawBlocks) {
    if (block.startsWith('### ')) {
      const headerTitle = block.replace(/^###\s+/, '').replace(/:$/, '').trim();
      currentSection = {
        title: headerTitle.charAt(0).toUpperCase() + headerTitle.slice(1).toLowerCase(),
        paragraphs: [],
        bullets: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Identificar se o bloco é uma lista de marcadores
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const hasBullets = lines.some(l => /^[-•*–—]|\d+\.|\w+:\s+/i.test(l));

    if (hasBullets && lines.length > 1) {
      const bullets: string[] = [];
      const paras: string[] = [];

      for (const line of lines) {
        const cleanedLine = line.replace(/^[-•*–—]\s*/, '').trim();
        if (cleanedLine) {
          bullets.push(cleanedLine);
        }
      }

      if (currentSection) {
        currentSection.bullets = [...(currentSection.bullets || []), ...bullets];
      } else {
        if (!intro && paras.length) intro = paras.join(' ');
        sections.push({ paragraphs: paras, bullets });
      }
    } else {
      const cleanBlock = lines.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (!intro && !currentSection) {
        intro = cleanBlock;
      } else if (currentSection) {
        currentSection.paragraphs.push(cleanBlock);
      } else {
        sections.push({ paragraphs: [cleanBlock] });
      }
    }
  }

  // Montar texto limpo corrido para fallback/SEO
  const cleanText = [intro, ...sections.map(s => [s.title ? `${s.title}:` : '', ...s.paragraphs, ...(s.bullets || []).map(b => `• ${b}`)].filter(Boolean).join('\n'))]
    .filter(Boolean)
    .join('\n\n');

  return {
    intro: intro || cleanText.slice(0, 200),
    sections,
    cleanText,
  };
}
