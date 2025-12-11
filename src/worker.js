export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 访问根目录时，直接返回 api.enc 文件
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // 检查 ASSETS 绑定
      if (!env.ASSETS) {
        return new Response('ASSETS binding not configured', { status: 500 });
      }
      
      // 尝试获取 api.enc 文件
      const apiEncRequest = new Request(`${url.origin}/api.enc`);
      const response = await env.ASSETS.fetch(apiEncRequest);
      
      // 如果找到文件，返回它
      if (response.status === 200) {
        // 设置下载头
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', 'attachment; filename="api.enc"');
        
        return new Response(response.body, {
          status: 200,
          headers: headers
        });
      }
      
      // 如果没找到，返回错误
      return new Response('api.enc file not found', { status: 404 });
    }
    
    // 其他请求正常处理（包括直接访问 /api.enc）
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
