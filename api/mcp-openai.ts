import { handleMcpRequest } from '../src/http-handler.js';

// The OpenAI app directory listing points here. Same server, tools and
// corpus as /mcp, but answers never carry the person-facing Read link,
// because OpenAI's guidelines do not allow apps to promote digital services.
export default {
  fetch(request: Request): Promise<Response> {
    return handleMcpRequest(request, { endpoint: 'openai' });
  },
};
