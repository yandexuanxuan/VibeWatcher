import https from 'https';
import { LLMProvider } from './types';

const DEFAULT_MODEL = 'gpt-4o';

export function createOpenAIProvider(apiKey: string, model = DEFAULT_MODEL): LLMProvider {
  return {
    name: 'openai',
    async interpret(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
        });

        const options = {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            Authorization: `Bearer ${apiKey}`,
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.choices?.[0]?.message?.content ?? '');
            } catch {
              reject(new Error(`OpenAI API parse error: ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
      });
    },
  };
}