(function () {
    var w = window, d = document; if (w.chatWidgetLoaded) return; w.chatWidgetLoaded = true;
    var cfg = w.chatConfig || {};
    if (!cfg.baseUrl || !cfg.platformId) {
        console.error('Chat widget: baseUrl and platformId must be provided in window.chatConfig');
        return;
    }
    cfg.width = cfg.width || '360px'; cfg.height = cfg.height || '560px';
    var css = '#chat-bubble{position:fixed;right:20px;bottom:20px;z-index:999999;background:#1d4ed8;color:#fff;border-radius:9999px;width:56px;height:56px;box-shadow:0 8px 20px rgba(0,0,0,.2);border:0;cursor:pointer;font-size:24px;line-height:56px;text-align:center}' +
        '#chat-panel{position:fixed;right:20px;bottom:92px;width:' + cfg.width + ';height:' + cfg.height + ';max-width:calc(100% - 40px);max-height:70vh;z-index:999999;box-shadow:0 10px 30px rgba(0,0,0,.25);border-radius:12px;overflow:hidden;opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .2s ease,transform .2s ease;background:#fff}' +
        '#chat-panel.open{opacity:1;transform:translateY(0);pointer-events:auto}' +
        '@media (max-width: 768px) { #chat-bubble { bottom: 90px; right: 16px; } #chat-panel { bottom: 160px; right: 16px; max-height: calc(100vh - 180px); } }';
    var s = d.createElement('style'); s.type = 'text/css'; s.appendChild(d.createTextNode(css)); d.head.appendChild(s);
    var bubble = d.createElement('button'); bubble.id = 'chat-bubble'; bubble.setAttribute('aria-label', 'Open chat'); bubble.innerHTML = '💬';
    var panel = d.createElement('div'); panel.id = 'chat-panel';
    var iframeSrc = cfg.baseUrl + '/livechat/' + encodeURIComponent(cfg.platformId); var qs = [];
    if (cfg.username) qs.push('username=' + encodeURIComponent(cfg.username));
    if (cfg.web) qs.push('web=' + encodeURIComponent(cfg.web));
    if (qs.length) iframeSrc += '?' + qs.join('&');
    var iframe = d.createElement('iframe'); iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = '0'; panel.appendChild(iframe);
    var iframeLoaded = false;
    bubble.addEventListener('click', function () {
        if (!iframeLoaded) { iframe.src = iframeSrc; iframeLoaded = true; }
        panel.classList.toggle('open');
    });
    w.addEventListener('message', function (e) { if (e.data && e.data.type === 'CEKAT_CHAT_MINIMIZE') { panel.classList.remove('open'); } });
    d.body.appendChild(bubble); d.body.appendChild(panel);
})();
