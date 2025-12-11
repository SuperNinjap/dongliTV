export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const accept = request.headers.get("accept") || "";
    const ua = request.headers.get("user-agent") || "";
    
    // === 添加缓存键 ===
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    
    // 尝试从缓存获取（静态资源缓存）
    if (request.method === "GET") {
      // 静态资源缓存策略
      if (url.pathname === "/" || url.pathname === "/home.html" || 
          url.pathname === "/api" || url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") || url.pathname.endsWith(".png")) {
        
        let response = await cache.match(cacheKey);
        
        if (response) {
          // 检查缓存是否过期（自定义逻辑）
          const cachedDate = new Date(response.headers.get('date'));
          const now = new Date();
          const cacheAge = (now - cachedDate) / 1000;
          
          // 首页缓存30分钟，API缓存5分钟，静态资源缓存2小时
          let maxAge = 7200; // 默认2小时
          if (url.pathname === "/" || url.pathname === "/home.html") maxAge = 1800;
          if (url.pathname === "/api") maxAge = 300;
          
          if (cacheAge < maxAge) {
            // 返回304或缓存的响应
            return response;
          }
        }
      }
    }

    // === 原有的逻辑 ===
    // 特殊处理 /api 路径
    if (url.pathname === "/api") {
      if (!env.ASSETS) {
        return new Response("ASSETS binding not configured", { status: 500 });
      }
      const response = await env.ASSETS.fetch(request);
      if (response.status === 200) {
        const headers = new Headers(response.headers);
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Disposition", 'attachment; filename="api"');
        // === 添加缓存头部 ===
        headers.set("Cache-Control", "public, max-age=300"); // API缓存5分钟
        headers.set("CDN-Cache-Control", "public, max-age=300");
        const cachedResponse = new Response(response.body, { status: 200, headers });
        
        // 存储到缓存
        ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
        return cachedResponse;
      }
      return new Response("api file not found", { status: 404 });
    }

    // 根目录或 home.html 访问
    if (url.pathname === "/" || url.pathname === "/home.html") {
      // 1. 浏览器访问
      if (ua.includes("Mozilla") && accept.includes("text/html")) {
        if (!env.ASSETS) {
          return new Response("ASSETS binding not configured", { status: 500 });
        }
        const homeRequest = new Request(`${url.origin}/home.html`);
        const response = await env.ASSETS.fetch(homeRequest);
        
        // === 添加缓存 ===
        if (response.status === 200) {
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "public, max-age=1800"); // 首页缓存30分钟
          headers.set("CDN-Cache-Control", "public, max-age=1800");
          const cachedResponse = new Response(response.body, response);
          
          // 存储到缓存
          ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
          return cachedResponse;
        }
        return response;
      }

      // 2. 调试工具
      if (/curl|wget|httpie|python-requests/i.test(ua)) {
        const response = new Response("api 文件内容示例字符串", {
          status: 200,
          headers: { 
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300" // 文本缓存5分钟
          }
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }

      // 3. 其他情况默认当成 API 调用
      if (!env.ASSETS) {
        return new Response("ASSETS binding not configured", { status: 500 });
      }
      const apiRequest = new Request(`${url.origin}/api`);
      const response = await env.ASSETS.fetch(apiRequest);

      if (response.status === 200) {
        const headers = new Headers(response.headers);
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Disposition", 'attachment; filename="api"');
        headers.set("Cache-Control", "public, max-age=300");
        const cachedResponse = new Response(response.body, { status: 200, headers });
        
        ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
        return cachedResponse;
      }
      return new Response("api file not found", { status: 404 });
    }

    // 其他路径交给 ASSETS
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      
      // === 静态资源自动缓存 ===
      if (response.status === 200 && request.method === "GET") {
        const contentType = response.headers.get("content-type") || "";
        let maxAge = 7200; // 默认2小时
        
        if (contentType.includes("text/html")) maxAge = 1800;
        else if (contentType.includes("application/javascript") || 
                 contentType.includes("text/css")) maxAge = 86400; // JS/CSS缓存1天
        else if (contentType.includes("image/")) maxAge = 2592000; // 图片缓存30天
        
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", `public, max-age=${maxAge}`);
        
        const cachedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
        
        ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
        return cachedResponse;
      }
      
      return response;
    }
    return new Response("Not Found", { status: 404 });
  }
};
