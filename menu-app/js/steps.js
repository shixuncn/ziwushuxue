/* 本地工具：视频链接识别 + 文案拆步骤（不联网） */
(function (global) {
  'use strict';

  var PLATFORMS = [
    { key: 'douyin', label: '抖音', hosts: ['douyin.com', 'iesdouyin.com', 'douyinpic.com'] },
    { key: 'xhs', label: '小红书', hosts: ['xiaohongshu.com', 'xhslink.com'] },
    { key: 'bilibili', label: '哔哩哔哩', hosts: ['bilibili.com', 'b23.tv'] },
    { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
    { key: 'kuaishou', label: '快手', hosts: ['kuaishou.com', 'gifshow.com'] },
    { key: 'weibo', label: '微博', hosts: ['weibo.com', 'weibo.cn'] },
    { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
    { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
    { key: 'channels', label: '视频号', hosts: ['channels.weixin.qq.com', 'finder.video.qq.com'] }
  ];

  var NOISE = [
    /点赞|点个赞|双击|一键三连|三连|关注我|求关注|收藏|转发|评论|加号|小爱心/,
    /长按|识别二维码|扫码|打开APP|下载APP|完整版|更多视频|持续更新|每天更新|日更|主页/,
    /BGM|bgm|背景音乐|配音|字幕|剪映|出品|拍摄|剪辑|文案|片头|片尾/,
    /抖音|小红书|视频号|快手|B站|哔哩哔哩|YouTube|youtube/,
    /橱窗|小黄车|下单|购买链接|同款|链接在|评论区|私信|粉丝|直播间/,
    /仅供参考|非专业|翻车|第一次做|教程分享|记得|别忘了|一定要试试|安排上/
  ];

  var COOK = /切|炒|煮|炖|蒸|炸|煎|烤|焯|腌|拌|揉|擀|焖|煸|淋|撒|倒|放|加|调|盛|装盘|出锅|洗净|去皮|切片|切丝|切块|切段|剁|打散|搅|泡|沥干|过油|勾芡|收汁|煨|熬|冷藏|冷冻|分钟|小时|克|勺|碗|火|热锅|冷油|焯水|备用/;

  var HEADING = /^(食材|用料|材料|调料|配料|做法|步骤|制作|方法|小贴士|注意事项|准备工作)[:：]?$/;

  function platformOf(url) {
    var u = normalizeVideoUrl(url);
    if (!u) return null;
    var host;
    try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return null; }
    host = host.replace(/^www\./, '');
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = PLATFORMS[i];
      for (var j = 0; j < p.hosts.length; j++) {
        if (host === p.hosts[j] || host.slice(-(p.hosts[j].length + 1)) === '.' + p.hosts[j]) {
          return { key: p.key, label: p.label };
        }
      }
    }
    return { key: 'link', label: '视频' };
  }

  function normalizeVideoUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    // 抖音/小红书的分享文案里常混着口令，先取出其中的链接
    var found = v.match(/https?:\/\/[^\s，,。；;]+/i);
    if (found) v = found[0];
    v = v.replace(/[）)】\]。，,；;]+$/, '');
    if (!/^https?:\/\//i.test(v)) {
      if (/^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
      else return '';
    }
    try {
      var u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (!u.hostname || !u.hostname.indexOf) return '';
      return u.href;
    } catch (e) {
      return '';
    }
  }

  function stripMarkup(text) {
    return text
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/#[^#\s]{1,24}/g, ' ')
      .replace(/@[A-Za-z0-9_\u4e00-\u9fa5-]{1,24}/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu, ' ')
      .replace(/[「」『』“”"'`]/g, '');
  }

  function stripMarker(line) {
    return line
      .replace(/^第[一二三四五六七八九十百零]+步\s*[：:、.，,）)]?\s*/, '')
      .replace(/^[(（]?\d{1,2}[)）]?\s*[、.．:：]\s*/, '')
      .replace(/^\d{1,2}\s*[、.．)）]\s*/, '')
      .replace(/^\d{1,2}\s+/, '')
      .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '')
      .replace(/^[一二三四五六七八九十]+[、.．，,：:]\s*/, '')
      .trim();
  }

  function splitSentences(text) {
    var raw = text.split(/([。！？!?；;])/);
    var parts = [];
    for (var i = 0; i < raw.length; i += 2) {
      parts.push((raw[i] + (raw[i + 1] || '')).trim());
    }
    var out = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      if (p.length > 140) {
        p.split(/[，,、]/).forEach(function (q) {
          q = q.trim();
          if (q) out.push(q);
        });
      } else {
        out.push(p);
      }
    });
    return out;
  }

  function parse(raw) {
    if (!raw) return [];
    var text = String(raw)
      .replace(/\r\n?/g, '\n')
      .replace(/[０-９]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 65248);
      })
      .replace(/[ \t\u3000]+/g, ' ');

    text = stripMarkup(text);

    // 句末紧跟编号 → 换行
    text = text.replace(/([。！？!?；;])\s*(\d{1,2}\s*[、.．)）]\s*(?!\d))/g, '$1\n$2');
    // 空白后的编号 → 换行
    text = text.replace(/(^|\s)(\d{1,2}\s*[、.．)）]\s*(?!\d)|第[一二三四五六七八九十百零]+步\s*[：:、.，,]?)/g, '$1\n$2');
    // 中文数字序号
    text = text.replace(/(^|\s)([一二三四五六七八九十]+)\s*[、.．，,：:]\s*/g, '$1\n$2、');

    var lines = text.split(/\n+/);

    var steps = [];
    lines.forEach(function (line) {
      line = line.replace(/\s+/g, ' ').trim();
      if (!line) return;
      line = stripMarker(line).replace(/^[、.．:：,，;；\-—]+/, '').trim();
      if (!line) return;
      if (HEADING.test(line)) return;
      if (line.length <= 14 && !COOK.test(line) && /(教程|做法|分享|教学|合集|vlog|Vlog)$/.test(line)) return;
      if (steps.length && steps[steps.length - 1] === line) return;

      var noisy = false;
      for (var i = 0; i < NOISE.length; i++) {
        if (NOISE[i].test(line)) { noisy = true; break; }
      }
      if (noisy && !COOK.test(line)) return;

      var chunks = splitSentences(line);
      chunks.forEach(function (chunk) {
        chunk = chunk.replace(/^[、.．:：,，;；\-—]+/, '').trim();
        if (!chunk) return;
        if (chunk.length < 3) {
          if (steps.length) steps[steps.length - 1] += chunk;
          return;
        }
        if (/^[0-9,.，。！？!?、；;：:\-— ]+$/.test(chunk)) return;
        if (steps.indexOf(chunk) !== -1) return;
        steps.push(chunk);
      });
    });

    return steps.slice(0, 60);
  }

  global.StepTools = { parse: parse, platformOf: platformOf, normalizeVideoUrl: normalizeVideoUrl };
})(window);
