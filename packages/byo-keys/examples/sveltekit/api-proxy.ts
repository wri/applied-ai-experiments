// =============================================================================
// SvelteKit API Proxy for CORS-Restricted Providers
// =============================================================================
//
// This is a minimal passthrough proxy that allows browser-based apps to
// communicate with LLM APIs that don't support CORS (like Anthropic and OpenAI).
//
// The proxy:
// 1. Receives requests from the browser
// 2. Forwards them to the provider API
// 3. Streams the response back to the browser
//
// IMPORTANT: This proxy does NOT store or log API keys. Keys are passed through
// from the client request headers directly to the provider.
//
// File: src/routes/api/proxy/[...path]/+server.ts
// =============================================================================

import type { RequestHandler } from './$types';

// Provider configurations
const PROVIDERS: Record<string, { baseUrl: string; authHeader: string }> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    authHeader: 'x-api-key',
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    authHeader: 'authorization',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    authHeader: 'authorization',
  },
};

// Headers to forward from client to provider
const FORWARD_REQUEST_HEADERS = [
  'content-type',
  'authorization',
  'x-api-key',
  'anthropic-version',
  'openai-organization',
];

// Headers to forward from provider to client
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'x-request-id',
  'x-ratelimit-limit-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-remaining-tokens',
];

export const POST: RequestHandler = async ({ params, request }) => {
  const path = params.path ?? '';
  const [provider, ...rest] = path.split('/');
  const apiPath = '/' + rest.join('/');
  
  const config = PROVIDERS[provider];
  
  if (!config) {
    return new Response(
      JSON.stringify({ error: `Unknown provider: ${provider}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Build the target URL
  const targetUrl = `${config.baseUrl}${apiPath}`;
  
  // Forward relevant headers
  const headers = new Headers();
  
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  
  try {
    // Make the request to the provider
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: request.body,
      // @ts-ignore - duplex is required for streaming request bodies
      duplex: 'half',
    });
    
    // Build response headers
    const responseHeaders = new Headers();
    
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) {
        responseHeaders.set(name, value);
      }
    }
    
    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    // Return the response, streaming if applicable
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 502, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

// Handle preflight requests
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
};


// =============================================================================
// Alternative: Standalone Node.js Proxy Server
// =============================================================================
//
// If you're not using SvelteKit, here's a standalone Express proxy:
//
// ```typescript
// // proxy-server.ts
// import express from 'express';
// import cors from 'cors';
// 
// const app = express();
// 
// app.use(cors());
// app.use(express.json({ limit: '10mb' }));
// 
// const PROVIDERS = {
//   anthropic: 'https://api.anthropic.com',
//   openai: 'https://api.openai.com',
// };
// 
// app.all('/proxy/:provider/*', async (req, res) => {
//   const { provider } = req.params;
//   const path = req.params[0];
//   const baseUrl = PROVIDERS[provider];
//   
//   if (!baseUrl) {
//     return res.status(400).json({ error: 'Unknown provider' });
//   }
//   
//   try {
//     const response = await fetch(`${baseUrl}/${path}`, {
//       method: req.method,
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': req.headers.authorization,
//         'x-api-key': req.headers['x-api-key'],
//         'anthropic-version': req.headers['anthropic-version'],
//       },
//       body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
//     });
//     
//     // Stream the response
//     res.status(response.status);
//     response.headers.forEach((value, key) => res.setHeader(key, value));
//     response.body?.pipeTo(new WritableStream({
//       write(chunk) { res.write(chunk); },
//       close() { res.end(); },
//     }));
//   } catch (error) {
//     res.status(502).json({ error: 'Proxy error' });
//   }
// });
// 
// app.listen(3001, () => console.log('Proxy running on :3001'));
// ```
// =============================================================================
