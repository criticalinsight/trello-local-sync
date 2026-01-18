import { PROMPT_TEMPLATES, type PromptTemplate } from '../data/templates';
import { getEmbedding } from '../aiService';

// Cache for template embeddings
const templateEmbeddings = new Map<string, number[]>();
let isCaching = false;

// Cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Pre-calculate embeddings (lazy load)
async function ensureEmbeddings() {
    if (templateEmbeddings.size > 0 || isCaching) return;
    isCaching = true;
    console.log('[TemplateMatcher] Caching embeddings...');

    // Process in parallel chunks to avoid rate limits
    // For now, just do all 
    for (const t of PROMPT_TEMPLATES) {
        // Embed the trigger + description for rich context
        const text = `${t.trigger}: ${t.description}`;
        const emb = await getEmbedding(text);
        if (emb.length > 0) {
            templateEmbeddings.set(t.id, emb);
        }
    }
    isCaching = false;
    console.log(`[TemplateMatcher] Cached ${templateEmbeddings.size} templates.`);
}

export async function findBestMatchingTemplate(userText: string): Promise<PromptTemplate | null> {
    if (!userText || userText.length < 10) return null;

    // Trigger background caching if needed (fire and forget)
    if (templateEmbeddings.size === 0) {
        ensureEmbeddings();
    }

    const normalizedText = userText.toLowerCase();

    // 1. FAST PATH: Keyword Matching (Legacy)
    // Run this first to avoid API call latency if there's an obvious exact match
    for (const template of PROMPT_TEMPLATES) {
        if (normalizedText.includes(template.trigger.toLowerCase())) {
            return template; // Immediate High Confidence Match
        }
    }

    // 2. SEMANTIC PATH: Embeddings
    // Only pay the API cost if we have cached templates to compare against
    if (templateEmbeddings.size > 0) {
        try {
            const userEmb = await getEmbedding(userText);
            if (userEmb.length === 0) return null;

            let bestMatch: PromptTemplate | null = null;
            let maxScore = -1;

            for (const template of PROMPT_TEMPLATES) {
                const templEmb = templateEmbeddings.get(template.id);
                if (!templEmb) continue;

                const score = cosineSimilarity(userEmb, templEmb);
                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = template;
                }
            }

            // Semantic Threshold
            if (maxScore > 0.75) {
                console.log(`[TemplateMatcher] Semantic Match: ${bestMatch?.id} (${maxScore.toFixed(2)})`);
                return bestMatch;
            }
        } catch (e) {
            console.warn('[TemplateMatcher] Semantic search failed', e);
        }
    }

    return null;
}
