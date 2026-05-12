import http from 'http';
import { LLMProvider } from './types';

const DEFAULT_MODEL = 'llama3';
const DEFAULT_URL = 'http://localhost:11434';

export function createOllamaProvider(baseUrl = DEFAULT_URL, model = DEFAULT_MODEL): LLMProvider {
  return {
    name: 'ollama',
    async interpret(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model,
          prompt,
          stream: false,
        });

        const url = new URL('/api/generate', baseUrl);
        const options: http.RequestOptions = {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.response ?? '');
            } catch {
              reject(new Error(`Ollama API parse error: ${data}`));
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