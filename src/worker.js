export default {
  async fetch(request, env) {
    console.log('Environment keys:', Object.keys(env));
    
    const url = new URL(request.url);
    
    // 首页处理
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // 检查 ASSETS 绑定
      if (!env.ASSETS) {
        return new Response('ASSETS binding not found. Available bindings: ' + Object.keys(env).join(', '), {
          headers: { 'content-type': 'text/plain' }
        });
      }
      
      try {
        // 尝试获取 api.enc
        const response = await env.ASSETS.fetch(new Request(`${url.origin}/api.enc`));
        
        if (response.status === 404) {
          return new Response('api.enc not found at root directory', { 
            status: 404,
            headers: { 'content-type': 'text/plain' }
          });
        }
        
        return response;
      } catch (error) {
        return new Response('Error fetching file: ' + error.message, {
          status: 500,
          headers: { 'content-type': 'text/plain' }
        });
      }
    }
    
    // 其他请求
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
