import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { config } from '../../../src/config/index.js';
import { networkEnabled, request } from '../../shared/http.js';
import { cleanText, joinArgs } from '../../shared/text.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

/** Últimos turnos por chat: la IA recuerda el hilo sin llenar la memoria. */
const HISTORY_LIMIT = 8;
type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };
const history = new Map<string, ChatMessage[]>();

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

export const aiEnabled = (): boolean => Boolean(config.bots.ai.apiKey) && networkEnabled();

async function ask(prompt: string, chat: string, author: string): Promise<string | null> {
  const previous = history.get(chat) ?? [];
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        `Eres ${RAIDEN.name}, un bot anime de WhatsApp con personalidad de Raiden Shogun: directa, elegante y con humor seco. ` +
        'Responde en español, en 3 frases como máximo y sin markdown complejo.',
    },
    ...previous,
    { role: 'user', content: `${author}: ${prompt}` },
  ];

  const result = await request(`${config.bots.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.bots.ai.apiKey}` },
    body: { model: config.bots.ai.model, messages, max_tokens: config.bots.ai.maxTokens, temperature: 0.8 },
    timeoutMs: 20_000,
  });
  if (!result.ok) return null;
  const data = result.json<ChatCompletion>();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) return null;

  const next: ChatMessage[] = [...messages.slice(1), { role: 'assistant', content: answer }];
  history.set(chat, next.slice(-HISTORY_LIMIT));
  return answer;
}

const ai: Command = {
  name: 'ai',
  category: 'IA',
  usage: '.ai <texto> | .ai reset',
  description: 'Conversa con la IA del bot. Con `.ai reset` se olvida la conversación.',
  async run(ctx) {
    const prompt = cleanText(joinArgs(ctx.args), 500);

    if (/^reset|olvida|limpiar$/i.test(prompt)) {
      history.delete(ctx.chat);
      await ctx.reply(raidenNote('🧠 Listo, olvidé la conversación de este chat.'));
      return;
    }

    if (!prompt) {
      await ctx.reply(raidenCard({
        title: 'IA de Raiden',
        emoji: '🧠',
        lines: [
          'Escríbeme algo: `.ai ¿quién ganaría, Raiden o Zhongli?`',
          '`.ai reset` borra el contexto del chat.',
          aiEnabled() ? `Modelo ⁙ ${config.bots.ai.model}` : 'Falta configurar `AI_API_KEY` en el servidor.',
        ],
      }));
      return;
    }

    if (!aiEnabled()) {
      await ctx.reply(raidenCard({
        title: 'IA sin configurar',
        emoji: '🔌',
        lines: [
          'El servidor todavía no tiene clave de IA.',
          'Configura `AI_API_KEY` (y, si usas otro proveedor, `AI_BASE_URL` y `AI_MODEL`).',
          'El resto de comandos de Raiden funcionan sin esa clave.',
        ],
      }));
      return;
    }

    const answer = await ask(prompt, ctx.chat, ctx.senderName || 'alguien');
    await ctx.reply(
      answer
        ? raidenCard({ title: 'Respuesta', emoji: '🧠', lines: [answer] })
        : raidenNote('⚠️ La IA no respondió. Inténtalo de nuevo en unos segundos.'),
    );
  },
};

registerPackCommand(RAIDEN.slug, ai);
