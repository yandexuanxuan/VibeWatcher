import https from 'https';
import { LLMProvider } from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export function createClaudeProvider(apiKey: string, model = DEFAULT_MODEL): LLMProvider {
  return {
    name: 'claude',
    async interpret(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const options = {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.content?.[0]?.text ?? '');
            } catch {
              reject(new Error(`Claude API parse error: ${data}`));
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