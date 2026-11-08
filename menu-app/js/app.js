/* 味单 · 电子菜单 — 交互逻辑 */
(function () {
  'use strict';

  var DEMO = {
    restaurant: {
      name: '山海小馆',
      subtitle: '山海之间 · 一席家常'
    },
    categories: [
      { id: 'c-signature', name: '招牌推荐' },
      { id: 'c-hot', name: '热菜' },
      { id: 'c-staple', name: '主食' },
      { id: 'c-soup', name: '汤羹' },
      { id: 'c-sweet', name: '甜品饮品' }
    ],
    items: [
      {
        id: 'i-1', categoryId: 'c-signature', name: '古法红烧肉', desc: '五花三层，慢火两小时，酱香浓郁、肥而不腻。', tags: ['招牌', '微甜'],
        image: 'images/demo/braised-pork.jpg', available: true, video: '',
        steps: [
          '五花肉切 3 厘米方块，冷水下锅，加姜片与料酒焯 3 分钟。',
          '捞出沥干，热锅少油，下肉块煸至四面微黄。',
          '放冰糖小火炒出糖色，加生抽、老抽翻匀上色。',
          '加高汤没过肉，小火炖 90 分钟，转大火收汁。',
          '盛盘撒葱花，静置 2 分钟再上桌。'
        ]
      },
      { id: 'i-2', categoryId: 'c-signature', name: '农家小炒肉', desc: '青椒与土猪肉猛火快炒，锅气十足，最是下饭。', tags: ['下饭', '微辣'], image: null, available: true, video: '', steps: [] },
      {
        id: 'i-3', categoryId: 'c-hot', name: '清蒸鲈鱼', desc: '当日鲜活鲈鱼，只放葱姜与头抽，吃的是一口鲜。', tags: ['鲜活', '清蒸'],
        image: 'images/demo/steamed-fish.jpg', available: true, video: '',
        steps: [
          '鲈鱼处理干净，两面各划三刀，抹少许盐。',
          '盘底铺葱姜，鱼身放几片姜，水开后上锅。',
          '大火蒸 8 分钟，关火焖 2 分钟取出。',
          '倒掉盘中汤汁，淋蒸鱼豉油，撒葱丝。',
          '热油浇在葱丝上激香即可。'
        ]
      },
      { id: 'i-4', categoryId: 'c-hot', name: '蒜蓉西兰花', desc: '现剥蒜蓉小火慢煸，脆嫩清甜，少油不寡淡。', tags: ['时蔬', '少油'], image: 'images/demo/broccoli.jpg', available: true, video: '', steps: [] },
      {
        id: 'i-5', categoryId: 'c-staple', name: '葱油拌面', desc: '小葱熬至焦香，酱油一拌，简单却叫人惦记。', tags: ['手工面', '葱香'],
        image: 'images/demo/noodles.jpg', available: true, video: '',
        steps: [
          '小葱洗净切段，葱白与葱绿分开。',
          '冷油下葱白，小火慢熬至微焦，再下葱绿。',
          '葱段捞出，热油中加生抽、老抽与少许糖调成葱油汁。',
          '面条煮至断生，捞出沥干。',
          '淋两勺葱油汁拌匀，铺上葱段即可。'
        ]
      },
      {
        id: 'i-6', categoryId: 'c-soup', name: '菌菇老鸭汤', desc: '老鸭与山菌煨足三小时，汤色清亮，暖胃回甘。', tags: ['慢炖', '暖胃'],
        image: 'images/demo/duck-soup.jpg', available: true, video: '', steps: []
      },
      { id: 'i-7', categoryId: 'c-sweet', name: '桂花酒酿丸子', desc: '手搓糯米小圆子，酒酿微醺，撒一把新桂花。', tags: ['甜品', '桂花'], image: 'images/demo/osmanthus-dessert.jpg', available: true, video: '', steps: [] },
      { id: 'i-8', categoryId: 'c-sweet', name: '手作酸梅汤', desc: '乌梅、山楂与陈皮慢煮，冰镇后酸甜解腻。', tags: ['冰饮', '解腻'], image: null, available: false, video: '', steps: [] }
    ]
  };

  var THEME_KEY = 'weidan-theme';
  var TIP_KEY = 'weidan-tip-shown';
  var els = {};
  var state = null;
  var currentCat = 'all';
  var searchQuery = '';
  var admin = false;
  var editingId = null;
  var draftImage = null;
  var deferredPrompt = null;
  var confirmResolve = null;
  var toastTimer = null;
  var urlCache = new WeakMap();

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function isBlob(value) { return typeof Blob !== 'undefined' && value instanceof Blob; }

  function imageSrc(image) {
    if (!image) return '';
    if (typeof image === 'string') return image;
    if (isBlob(image)) {
      if (!urlCache.has(image)) urlCache.set(image, URL.createObjectURL(image));
      return urlCache.get(image);
    }
    return '';
  }

  function formatBytes(bytes) {
    var n = Number(bytes) || 0;
    if (n <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    var v = n / Math.pow(1024, i);
    return (i === 0 ? v.toFixed(0) : v.toFixed(1)) + ' ' + units[i];
  }

  function toast(message, duration) {
    // 弹窗（top layer）会盖住页面级提示，必须把提示挪进当前弹窗
    var host = document.querySelector('dialog[open]') || document.body;
    if (els.toast.parentNode !== host) host.appendChild(els.toast);
    els.toast.textContent = message;
    els.toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('is-show');
    }, duration || 2600);
  }

  function setRecognizeStatus(text, kind) {
    var el = els.recognizeStatus;
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'recognize-status';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'recognize-status' + (kind ? ' is-' + kind : '');
  }

  function cacheElements() {
    [
      'restaurantName', 'restaurantSub', 'menuMeta', 'cats',
      'menu', 'searchInput', 'themeBtn', 'settingsBtn', 'adminBtn', 'fabAdd',
      'itemDialog', 'itemForm', 'itemDialogTitle', 'imagePicker', 'imagePreview',
      'removeImageBtn', 'imageInput', 'fName', 'fCategory',
      'fDesc', 'fTags', 'fAvailable', 'manageDialog', 'shopForm', 'shopName',
      'shopSub', 'apiBase', 'catList', 'newCatInput', 'addCatBtn',
      'exportBtn', 'importBtn', 'importInput', 'installBtn', 'installHint',
      'storageText', 'resetBtn', 'installDialog', 'installSteps', 'confirmDialog',
      'confirmTitle', 'confirmMessage', 'confirmOk', 'confirmCancel', 'lightbox',
      'lightboxImg', 'lightboxCaption', 'toast', 'fVideo', 'videoPlatform',
      'fetchVideoBtn', 'fSteps',
      'stepsCount', 'smartStepsBtn', 'uploadVideoBtn', 'videoFileInput', 'recognizeStatus',
      'extractDialog', 'extractInput', 'extractRunBtn',
      'extractResult', 'extractCount', 'extractList', 'applyStepsBtn', 'dishDialog',
      'dishContent'
    ].forEach(function (id) { els[id] = document.getElementById(id); });
  }

  /* ---------- 数据 ---------- */

  function normalizeState(raw) {
    if (!raw || !Array.isArray(raw.categories) || !Array.isArray(raw.items)) return null;
    var restaurant = Object.assign(
      { name: '我的餐厅', subtitle: '' },
      raw.restaurant || {}
    );
    var categories = raw.categories.map(function (c) {
      return { id: String(c.id || uid()), name: String(c.name || '未分类').slice(0, 24) };
    });
    var knownIds = {};
    categories.forEach(function (c) { knownIds[c.id] = true; });
    var firstCat = categories[0] ? categories[0].id : '';
    var items = raw.items.map(function (it) {
      var image = null;
      if (typeof it.image === 'string' && it.image) image = it.image;
      else if (isBlob(it.image)) image = it.image;
      var categoryId = String(it.categoryId || firstCat);
      if (!knownIds[categoryId]) categoryId = firstCat;
      var steps = Array.isArray(it.steps) ? it.steps.map(function (s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 200);
      }).filter(Boolean).slice(0, 60) : [];
      return {
        id: String(it.id || uid()),
        categoryId: categoryId,
        name: String(it.name || '未命名菜品').slice(0, 60),
        desc: String(it.desc || '').slice(0, 200),
        tags: Array.isArray(it.tags) ? it.tags.map(String).slice(0, 8) : [],
        image: image,
        video: typeof it.video === 'string' ? (StepTools.normalizeVideoUrl(it.video) || '') : '',
        steps: steps,
        available: it.available !== false
      };
    });
    return {
      restaurant: {
        name: String(restaurant.name || '我的餐厅').slice(0, 30),
        subtitle: String(restaurant.subtitle || '').slice(0, 60)
      },
      categories: categories,
      items: items
    };
  }

  function persist() {
    return MenuDB.save(state).catch(function (err) {
      console.error(err);
      toast('保存失败：浏览器存储空间可能已满，请先导出备份', 4000);
      throw err;
    });
  }

  /* ---------- 渲染 ---------- */

  function renderAll() {
    if (currentCat !== 'all' && !state.categories.some(function (c) { return c.id === currentCat; })) {
      currentCat = 'all';
    }
    renderBrand();
    renderCats();
    renderMenu();
  }

  function renderBrand() {
    var r = state.restaurant;
    var name = r.name || '我的餐厅';
    els.restaurantName.textContent = name;
    els.restaurantSub.textContent = r.subtitle || '';
    els.restaurantSub.hidden = !r.subtitle;
    document.title = name + ' · 电子菜单';
  }

  function renderCats() {
    var total = state.items.length;
    var html = '<button class="chip' + (currentCat === 'all' ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' +
      (currentCat === 'all') + '" data-cat="all">全部<span class="chip-num">' + total + '</span></button>';

    state.categories.forEach(function (cat) {
      var count = state.items.filter(function (it) { return it.categoryId === cat.id; }).length;
      html += '<button class="chip' + (currentCat === cat.id ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' +
        (currentCat === cat.id) + '" data-cat="' + escapeHTML(cat.id) + '">' +
        escapeHTML(cat.name) + '<span class="chip-num">' + count + '</span></button>';
    });

    if (admin) {
      html += '<button class="chip chip-add" type="button" data-manage-cats>＋ 分类</button>';
    }
    els.cats.innerHTML = html;
  }

  function groupHTML(name, list) {
    return '<section class="group">' +
      '<div class="group-head"><h2>' + escapeHTML(name) + '</h2><span>' + list.length + ' 道</span></div>' +
      '<div class="grid">' + list.map(cardHTML).join('') + '</div>' +
      '</section>';
  }

  function cardHTML(item) {
    var name = escapeHTML(item.name);
    var initial = escapeHTML((item.name || '菜').trim().slice(0, 1));
    var src = imageSrc(item.image);
    var img = src ? '<img src="' + escapeHTML(src) + '" alt="' + name + '" loading="lazy" decoding="async">' : '';
    var view = src ? ' data-view="' + escapeHTML(item.id) + '"' : '';
    var sold = item.available === false ? '<span class="soldout-badge">售罄</span>' : '';
    var tagHTML = '';
    if (item.tags && item.tags.length) {
      tagHTML = '<div class="tags">' + item.tags.slice(0, 3).map(function (tag) {
        return '<span class="tag">' + escapeHTML(tag) + '</span>';
      }).join('') + (item.tags.length > 3 ? '<span class="tag more">+' + (item.tags.length - 3) + '</span>' : '') + '</div>';
    }

    var extras = '';
    if (item.video) {
      var platform = StepTools.platformOf(item.video);
      extras += '<span class="extra"><svg class="ico"><use href="#i-play"></use></svg>' + escapeHTML(platform ? platform.label : '视频') + '</span>';
    }
    if (item.steps && item.steps.length) {
      extras += '<span class="extra"><svg class="ico"><use href="#i-list"></use></svg>' + item.steps.length + ' 步</span>';
    }
    var foot = (tagHTML || extras)
      ? '<div class="card-foot">' + tagHTML + (extras ? '<div class="card-extras">' + extras + '</div>' : '') + '</div>'
      : '';

    var moreHTML = '';
    if (item.video || (item.steps && item.steps.length)) {
      var label = item.steps && item.steps.length
        ? (item.video ? '查看做法与视频' : '查看做法')
        : '查看视频';
      moreHTML = '<button class="card-link" type="button" data-open="' + escapeHTML(item.id) + '">' +
        label + '<svg class="ico"><use href="#i-arrow"></use></svg></button>';
    }

    return '<article class="card' + (item.available === false ? ' is-soldout' : '') + '" data-id="' + escapeHTML(item.id) + '">' +
      '<div class="thumb"' + view + '>' +
        '<div class="ph"><span>' + initial + '</span></div>' +
        img +
        sold +
      '</div>' +
      '<div class="card-body">' +
        '<h3>' + name + '</h3>' +
        '<p class="card-desc">' + escapeHTML(item.desc || '') + '</p>' +
        foot +
      '</div>' +
      moreHTML +
      '<div class="card-admin">' +
        '<button class="mini-btn" type="button" data-edit="' + escapeHTML(item.id) + '" aria-label="编辑 ' + name + '"><svg class="ico"><use href="#i-edit"></use></svg></button>' +
        '<button class="mini-btn del" type="button" data-del="' + escapeHTML(item.id) + '" aria-label="删除 ' + name + '"><svg class="ico"><use href="#i-trash"></use></svg></button>' +
      '</div>' +
    '</article>';
  }

  function emptyHTML(title, desc) {
    return '<div class="empty">' +
      '<div class="empty-icon"><svg class="ico"><use href="#i-grid"></use></svg></div>' +
      '<h3>' + escapeHTML(title) + '</h3>' +
      '<p>' + escapeHTML(desc) + '</p>' +
      (admin ? '<button class="btn primary" type="button" data-add-first>添加菜品</button>' : '') +
      '</div>';
  }

  function renderMenu() {
    var q = searchQuery.trim().toLowerCase();
    var catName = function (id) {
      var c = state.categories.filter(function (x) { return x.id === id; })[0];
      return c ? c.name : '';
    };
    var matches = function (item) {
      if (!q) return true;
      var hay = (item.name + ' ' + (item.desc || '') + ' ' + (item.tags || []).join(' ') + ' ' +
        (item.steps || []).join(' ') + ' ' + catName(item.categoryId)).toLowerCase();
      return hay.indexOf(q) !== -1;
    };

    var cats = currentCat === 'all'
      ? state.categories
      : state.categories.filter(function (c) { return c.id === currentCat; });

    var shown = 0;
    var html = '';
    cats.forEach(function (cat) {
      var list = state.items.filter(function (it) {
        return it.categoryId === cat.id && matches(it);
      });
      if (!list.length) return;
      list.sort(function (a, b) { return Number(b.available) - Number(a.available); });
      shown += list.length;
      html += groupHTML(cat.name, list);
    });

    if (currentCat === 'all') {
      var known = {};
      state.categories.forEach(function (c) { known[c.id] = true; });
      var orphans = state.items.filter(function (it) { return !known[it.categoryId] && matches(it); });
      if (orphans.length) {
        shown += orphans.length;
        html += groupHTML('未分类', orphans);
      }
    }

    if (!shown) {
      var title;
      var desc;
      if (q) {
        title = '没有找到相关菜品';
        desc = '换个关键词试试，或清空搜索看看全部菜单。';
      } else if (currentCat !== 'all') {
        title = '这个分类还没有菜品';
        desc = admin ? '点击下方按钮，把第一道菜加进来。' : '师傅正在准备，敬请期待。';
      } else {
        title = '菜单还是空的';
        desc = admin ? '点击右上角或下方按钮，添加第一道菜。' : '本店菜单正在准备中，请稍候。';
      }
      html = emptyHTML(title, desc);
    }

    els.menu.innerHTML = html;
    var available = state.items.filter(function (it) { return it.available; }).length;
    els.menuMeta.textContent = q
      ? '找到 ' + shown + ' 道菜'
      : '共 ' + state.items.length + ' 道菜 · ' + available + ' 道供应中';
  }

  /* ---------- 主题 ---------- */

  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#12100c' : '#171410');
    var use = els.themeBtn.querySelector('use');
    if (use) use.setAttribute('href', dark ? '#i-sun' : '#i-moon');
    els.themeBtn.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
  }

  /* ---------- 管理模式 ---------- */

  function setAdmin(next) {
    admin = next;
    document.body.classList.toggle('admin', admin);
    els.adminBtn.textContent = admin ? '完成' : '管理';
    els.adminBtn.setAttribute('aria-pressed', String(admin));
    els.fabAdd.hidden = !admin;
    renderCats();
    renderMenu();
    if (admin) toast('管理模式已开启，可添加菜品与图片');
  }

  /* ---------- 菜品编辑 ---------- */

  function buildCategoryOptions(selectedId) {
    els.fCategory.innerHTML = state.categories.map(function (cat) {
      return '<option value="' + escapeHTML(cat.id) + '">' + escapeHTML(cat.name) + '</option>';
    }).join('');
    if (selectedId && state.categories.some(function (c) { return c.id === selectedId; })) {
      els.fCategory.value = selectedId;
    }
  }

  function updateImageUI() {
    var src = imageSrc(draftImage);
    if (src) {
      els.imagePreview.src = src;
      els.imagePreview.hidden = false;
      els.imagePicker.classList.add('has-image');
      els.removeImageBtn.hidden = false;
    } else {
      els.imagePreview.hidden = true;
      els.imagePreview.removeAttribute('src');
      els.imagePicker.classList.remove('has-image');
      els.removeImageBtn.hidden = true;
    }
  }

  /* ---------- 视频与步骤 ---------- */

  function stepsFromField() {
    return els.fSteps.value.split(/\n+/).map(function (line) {
      return line.trim();
    }).filter(Boolean).slice(0, 60);
  }

  function updateStepsCount() {
    var count = stepsFromField().length;
    els.stepsCount.textContent = count + ' 步';
    els.stepsCount.classList.toggle('is-empty', count === 0);
  }

  function updateVideoPreview() {
    updateFetchBtn();
    var raw = els.fVideo.value.trim();
    if (!raw) {
      els.videoPlatform.hidden = true;
      els.videoPlatform.textContent = '';
      els.videoPlatform.classList.remove('is-invalid');
      return;
    }
    var url = StepTools.normalizeVideoUrl(raw);
    els.videoPlatform.hidden = false;
    if (!url) {
      els.videoPlatform.textContent = '链接格式不对';
      els.videoPlatform.classList.add('is-invalid');
      return;
    }
    var platform = StepTools.platformOf(url);
    els.videoPlatform.textContent = platform ? platform.label : '视频链接';
    els.videoPlatform.classList.remove('is-invalid');
  }

  var extractSteps = [];

  // 打包成 App 后没有同源后端，识别服务地址可在「店铺设置」里配置
  var API_BASE_KEY = 'weidan.apiBase';

  /* ---------- 设备端字幕识别（Tesseract.js，离线可用） ---------- */
  var VENDOR_BASE = 'js/vendor/tesseract';
  var ocrWorkerPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('script')); };
      document.head.appendChild(s);
    });
  }

  function getOcrWorker() {
    if (ocrWorkerPromise) return ocrWorkerPromise;
    ocrWorkerPromise = (window.Tesseract ? Promise.resolve() : loadScript(VENDOR_BASE + '/tesseract.min.js'))
      .then(function () {
        return Tesseract.createWorker('chi_sim', 1, {
          workerPath: VENDOR_BASE + '/worker.min.js',
          corePath: VENDOR_BASE,
          langPath: VENDOR_BASE,
          gzip: false,
          cacheMethod: 'none',
          logger: function () {}
        });
      })
      .catch(function (err) {
        ocrWorkerPromise = null;
        throw err;
      });
    return ocrWorkerPromise;
  }

  var OCR_BAD_PAT = /(抖音|快手|小红书|视频号|西瓜|火山|关注我|点关注|双击|点赞|评论|转发|收藏|搜索|扫码|下载|http|www\.|\.com|@)/i;

  function cleanOcrLine(t) {
    return String(t || '')
      .replace(/\s+/g, '')
      .replace(/^[^\u4e00-\u9fffA-Za-z0-9]+/, '')
      .replace(/[^\u4e00-\u9fffA-Za-z0-9。，、：！？%℃°]+$/, '');
  }

  function lineLooksUseful(t) {
    if (!t || OCR_BAD_PAT.test(t)) return false;
    return (t.match(/[\u4e00-\u9fff]/g) || []).length >= 2;
  }

  function lineSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    var set = {};
    for (var i = 0; i < a.length; i++) set[a[i]] = true;
    var hit = 0;
    for (var j = 0; j < b.length; j++) if (set[b[j]]) hit++;
    return hit / Math.max(a.length, b.length);
  }

  function recognizeFramesLocally(frames, onProgress) {
    var lines = [];
    return getOcrWorker().then(function (worker) {
      var chain = Promise.resolve();
      frames.forEach(function (frame, idx) {
        chain = chain.then(function () {
          if (onProgress) onProgress(idx + 1, frames.length);
          return worker.recognize(frame).then(function (res) {
            var d = res && res.data ? res.data : {};
            var raw = (d.lines && d.lines.length)
              ? d.lines
              : [{ text: d.text || '', confidence: d.confidence || 0 }];
            raw.forEach(function (ln) {
              var t = cleanOcrLine(ln.text);
              if ((ln.confidence || 0) < 45) return;
              if (!lineLooksUseful(t)) return;
              lines.push(t);
            });
          });
        });
      });
      return chain.then(function () {
        var deduped = [];
        lines.forEach(function (t) {
          var last = deduped[deduped.length - 1];
          if (last && lineSimilarity(last, t) >= 0.72) return;
          deduped.push(t);
        });
        return deduped;
      });
    });
  }

  function localOcrRecognize(file, opt) {
    opt = opt || {};
    uploadErrorText = '';
    setRecognizeStatus('', '');
    setUploadBusy('本机识别中，约需 1 分钟…');
    var finish = function () { clearUploadBusy(); };
    return extractFrames(file, 48).then(function (frames) {
      if (!frames.length) {
        recognizeFail('无法读取这个视频的画面，试试手机相册里的原视频');
        return null;
      }
      setUploadBusy('识别画面文字 0/' + frames.length);
      return recognizeFramesLocally(frames, function (i, n) {
        setUploadBusy('识别画面文字 ' + i + '/' + n);
      }).then(function (lines) {
        if (lines.length) {
          showRecognized({ ok: true, text: lines.join('\n'), source: 'ocr' });
        } else {
          recognizeFail('没有识别到画面字幕文字' + (opt.speechHint || '，换个字幕更清晰的视频试试'));
        }
      });
    }).catch(function () {
      recognizeFail('画面识别失败，换个更清晰的视频试试');
    }).then(finish, finish);
  }

  function storedApiBase() {
    try { return String(localStorage.getItem(API_BASE_KEY) || '').trim(); } catch (e) { return ''; }
  }

  function apiBase() {
    var v = storedApiBase();
    if (!v && typeof window !== 'undefined' && window.WEIDAN_API_BASE) v = String(window.WEIDAN_API_BASE);
    return v ? v.replace(/\/+$/, '') : '';
  }

  function hasServer() {
    // 只有明确配置了识别服务地址才走服务端，否则一律使用本机离线识别
    return !!apiBase();
  }

  function apiUrl(path) {
    var b = apiBase();
    return b ? b + path : path;
  }

  function apiMissingHint() {
    return '链接识别需要识别服务支持，可改用「上传视频识别」在本机直接识别字幕';
  }

  var EXTRACT_API = '/api/extract-steps';
  var fetchLoading = false;
  var fetchBtnHTML = '';

  function updateFetchBtn() {
    if (!els.fetchVideoBtn) return;
    if (!fetchBtnHTML) fetchBtnHTML = els.fetchVideoBtn.innerHTML;
    els.fetchVideoBtn.disabled = fetchLoading || !StepTools.normalizeVideoUrl(els.fVideo.value);
    if (!fetchLoading && els.fetchVideoBtn.innerHTML !== fetchBtnHTML) {
      els.fetchVideoBtn.innerHTML = fetchBtnHTML;
    }
  }

  function setFetchLoading(loading) {
    fetchLoading = loading;
    if (loading) {
      els.fetchVideoBtn.disabled = true;
      els.fetchVideoBtn.textContent = '识别中…';
    } else {
      updateFetchBtn();
    }
  }

  function fetchVideoSteps() {
    var url = StepTools.normalizeVideoUrl(els.fVideo.value);
    if (!url || fetchLoading) return;
    if (!hasServer()) { toast(apiMissingHint(), 4200); return; }
    setFetchLoading(true);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 180000);
    fetch(apiUrl(EXTRACT_API), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
      signal: ctrl.signal
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false, error: '识别服务返回异常' }; });
    }).then(function (data) {
      if (data && data.ok && data.text) {
        openExtract(data.text);
        toast(data.source === 'ocr' ? '已从画面文字识别，点击「开始整理」拆成步骤' : '已识别视频语音，点击「开始整理」拆成步骤');
      } else {
        toast((data && data.error) || '识别失败，请稍后重试', 4000);
      }
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        toast('识别超时，视频可能太长，换个短视频试试', 4000);
      } else {
        toast('链接识别需要服务端支持，可改用「上传视频识别」在本机直接识别字幕', 4500);
      }
    }).finally(function () {
      clearTimeout(timer);
      setFetchLoading(false);
    });
  }

  var AUDIO_API = '/api/transcribe-audio';
  var FRAMES_API = '/api/ocr-frames';
  var uploadLoading = false;
  var uploadBtnHTML = '';
  var uploadErrorText = '';

  function setUploadBusy(label) {
    uploadLoading = true;
    setRecognizeStatus(label, 'busy');
    if (!els.uploadVideoBtn) return;
    if (!uploadBtnHTML) uploadBtnHTML = els.uploadVideoBtn.innerHTML;
    els.uploadVideoBtn.disabled = true;
    els.uploadVideoBtn.textContent = label;
  }

  function clearUploadBusy() {
    uploadLoading = false;
    setRecognizeStatus(uploadErrorText, uploadErrorText ? 'error' : '');
    if (!els.uploadVideoBtn) return;
    els.uploadVideoBtn.disabled = false;
    if (uploadBtnHTML) els.uploadVideoBtn.innerHTML = uploadBtnHTML;
  }

  function recognizeFail(message) {
    uploadErrorText = message;
    setRecognizeStatus(message, 'error');
    toast(message, 4500);
  }

  function postWithProgress(url, body, headers, onProgress, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.timeout = timeoutMs || 600000;
      Object.keys(headers || {}).forEach(function (k) { xhr.setRequestHeader(k, headers[k]); });
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = function () {
        try { resolve(JSON.parse(xhr.responseText || '{}')); }
        catch (e) { resolve({ ok: false, error: '识别服务返回异常' }); }
      };
      xhr.onerror = function () { reject(new Error('network')); };
      xhr.ontimeout = function () { reject(new Error('timeout')); };
      xhr.send(body);
    });
  }

  function pcmToWavBlob(pcm, rate) {
    var buf = new ArrayBuffer(44 + pcm.length * 2);
    var dv = new DataView(buf);
    function ws(off, s) { for (var i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
    for (var i = 0; i < pcm.length; i++) {
      var v = Math.max(-1, Math.min(1, pcm[i]));
      dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function extractAudioWav(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { reject(new Error('no-ac')); return; }
        var ac = new AC();
        ac.decodeAudioData(reader.result, function (buf) {
          var rate = 16000;
          var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
          var off = new Offline(1, Math.ceil(buf.duration * rate), rate);
          var src = off.createBufferSource();
          src.buffer = buf;
          src.connect(off.destination);
          src.start(0);
          off.startRendering().then(function (rendered) {
            try { ac.close(); } catch (e) {}
            resolve(pcmToWavBlob(rendered.getChannelData(0), rate));
          }, function (e) {
            try { ac.close(); } catch (e2) {}
            reject(e || new Error('render'));
          });
        }, function (e) {
          try { ac.close(); } catch (e2) {}
          reject(e || new Error('decode'));
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function extractFrames(file, maxFrames) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      var metaTimer = setTimeout(function () { resolve([]); }, 20000);
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      var frames = [];
      var stallTimer = null;
      function done() {
        clearTimeout(metaTimer);
        clearTimeout(stallTimer);
        URL.revokeObjectURL(url);
        v.removeAttribute('src');
        try { v.load(); } catch (e) {}
        resolve(frames);
      }
      v.addEventListener('error', done);
      v.addEventListener('loadedmetadata', function () {
        var dur = Math.min(v.duration || 0, 240);
        if (!dur || !v.videoWidth) { done(); return; }
        var step = Math.max(2, dur / maxFrames);
        var scale = Math.min(1, 960 / v.videoWidth);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(2, Math.round(v.videoWidth * scale));
        canvas.height = Math.max(2, Math.round(v.videoHeight * scale));
        var ctx = canvas.getContext('2d');
        var t = 0.2;
        function armStall() {
          clearTimeout(stallTimer);
          stallTimer = setTimeout(done, 15000);
        }
        v.addEventListener('seeked', function () {
          armStall();
          try {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.6));
          } catch (e) {}
          t += step;
          if (t < dur && frames.length < maxFrames) {
            v.currentTime = t;
          } else {
            done();
          }
        });
        armStall();
        v.currentTime = t;
      });
      v.src = url;
    });
  }

  function showRecognized(data) {
    openExtract(data.text);
    toast(data.source === 'ocr' ? '已从画面文字识别，点击「开始整理」拆成步骤' : '已识别视频语音，点击「开始整理」拆成步骤');
  }

  function uploadVideoSteps(file) {
    if (!file || uploadLoading) return;
    uploadErrorText = '';
    setRecognizeStatus('', '');
    if (!hasServer()) {
      // 没有配置识别服务（静态网页、App 默认状态）：直接在设备上离线识别画面字幕
      localOcrRecognize(file, { speechHint: '；人声讲解的视频可在「管理 → 店铺」填写识别服务地址' });
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      recognizeFail('视频超过 300MB，请剪短或压缩后再上传');
      return;
    }
    setUploadBusy('识别中…');

    // 语音与画面文字同时识别，最后取更可靠的一份
    var asrP = extractAudioWav(file).then(function (wav) {
      return postWithProgress(apiUrl(AUDIO_API), wav, { 'Content-Type': 'audio/wav' }, function (p) {
        setUploadBusy('上传 ' + Math.round(p * 100) + '%');
      }, 600000);
    }).catch(function () { return { ok: false }; });

    var ocrP = extractFrames(file, 60).then(function (frames) {
      if (!frames.length) return { ok: false, noFrames: true };
      setUploadBusy('识别画面文字…');
      var payload = frames.map(function (f) { return f.indexOf(',') >= 0 ? f.split(',')[1] : f; });
      return postWithProgress(apiUrl(FRAMES_API), JSON.stringify({ frames: payload }), { 'Content-Type': 'application/json' }, null, 600000);
    }).catch(function () { return { ok: false }; });

    Promise.all([asrP, ocrP])
      .then(function (r) {
        var a = r[0] || {};
        var o = r[1] || {};
        var asrText = a.ok && a.text ? String(a.text).trim() : '';
        var ocrText = o.ok && o.text ? String(o.text).trim() : '';
        var ocrLines = ocrText ? ocrText.split('\n').filter(function (s) { return s.trim(); }) : [];
        var ocrSentences = ocrLines.filter(function (s) { return s.trim().length >= 5; }).length;

        // 画面字幕通常比语音更准，优先采用；条件不足时退回语音
        if (ocrLines.length >= 2 && ocrSentences >= 2) {
          showRecognized({ ok: true, text: ocrText, source: 'ocr' });
        } else if (asrText) {
          showRecognized({ ok: true, text: asrText, source: 'audio' });
        } else if (ocrText) {
          showRecognized({ ok: true, text: ocrText, source: 'ocr' });
        } else {
          // 服务不可达或没有配置服务：一律退回设备端离线字幕识别
          return localOcrRecognize(file, {});
        }
        return null;
      })
      .then(function () { clearUploadBusy(); }, function () { clearUploadBusy(); });
  }

  function openExtract(presetText) {
    els.extractInput.value = typeof presetText === 'string' && presetText.trim()
      ? presetText.trim()
      : els.fSteps.value.trim();
    els.extractResult.hidden = true;
    els.extractList.innerHTML = '';
    els.extractCount.textContent = '';
    els.applyStepsBtn.disabled = true;
    extractSteps = [];
    if (!els.extractDialog.open) els.extractDialog.showModal();
    setTimeout(function () { els.extractInput.focus({ preventScroll: true }); }, 60);
  }

  function runExtract() {
    var text = els.extractInput.value.trim();
    if (!text) {
      toast('先把视频文案或字幕粘贴进来');
      els.extractInput.focus();
      return;
    }
    extractSteps = StepTools.parse(text);
    els.extractList.innerHTML = extractSteps.map(function (step, index) {
      return '<li><span class="dish-step-num">' + (index + 1) + '</span><p>' + escapeHTML(step) + '</p></li>';
    }).join('');
    els.extractCount.textContent = extractSteps.length + ' 步';
    els.extractResult.hidden = !extractSteps.length;
    els.applyStepsBtn.disabled = !extractSteps.length;
    if (!extractSteps.length) toast('没有识别到步骤，试试保留「1. 2. 3.」这样的编号');
  }

  function applyExtract() {
    if (!extractSteps.length) return;
    els.fSteps.value = extractSteps.join('\n');
    updateStepsCount();
    els.extractDialog.close();
    toast('已应用 ' + extractSteps.length + ' 个步骤，记得保存菜品');
  }

  function openItemEditor(id) {
    editingId = id || null;
    var item = id ? state.items.filter(function (it) { return it.id === id; })[0] : null;

    if (!state.categories.length) {
      state.categories.push({ id: uid(), name: '未分类' });
      renderCats();
    }

    els.itemDialogTitle.textContent = item ? '编辑菜品' : '添加菜品';
    buildCategoryOptions(item ? item.categoryId : state.categories[0].id);
    els.fName.value = item ? item.name : '';
    els.fDesc.value = item ? item.desc : '';
    els.fTags.value = item && item.tags.length ? item.tags.join('，') : '';
    els.fVideo.value = item ? (item.video || '') : '';
    els.fSteps.value = item && item.steps.length ? item.steps.join('\n') : '';
    updateVideoPreview();
    updateStepsCount();
    els.fAvailable.checked = item ? item.available !== false : true;
    draftImage = item ? item.image : null;
    updateImageUI();
    els.imagePicker.classList.remove('is-dragover', 'is-loading');
    uploadErrorText = '';
    setRecognizeStatus('', '');
    var hintEl = document.getElementById('videoHint');
    if (hintEl) {
      hintEl.textContent = hasServer()
        ? '人声讲解或画面字幕均可识别，3 分钟内最佳'
        : '可离线识别画面字幕；人声识别请在「管理 → 店铺」填写服务地址';
    }
    els.itemDialog.showModal();
    setTimeout(function () { els.fName.focus({ preventScroll: true }); }, 60);
  }

  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var objectURL = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(objectURL);
            if (blob) resolve(blob);
            else reject(new Error('图片编码失败'));
          }, 'image/jpeg', quality);
        } catch (err) {
          URL.revokeObjectURL(objectURL);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectURL);
        reject(new Error('无法读取图片'));
      };
      img.src = objectURL;
    });
  }

  function handleImageFile(file) {
    if (!file) return;
    // iOS 相机/相册偶尔拿不到 MIME 类型，为空时也尝试解码
    if (file.type && !file.type.match(/^image\//)) {
      toast('请选择图片文件（JPG / PNG / WebP）');
      return;
    }
    els.imagePicker.classList.add('is-loading');
    compressImage(file, 1600, 0.8).then(function (blob) {
      draftImage = blob;
      updateImageUI();
      toast('图片已添加，保存菜品后生效');
    }).catch(function (err) {
      console.error(err);
      toast('图片处理失败，请换一张 JPG / PNG 图片');
    }).then(function () {
      els.imagePicker.classList.remove('is-loading');
    });
  }

  /* ---------- 管理面板 ---------- */

  function openManage(tab) {
    syncShopForm();
    renderCatList();
    if (!els.manageDialog.open) els.manageDialog.showModal();
    switchManageTab(tab || 'shop');
  }

  function switchManageTab(tab) {
    $$('.tab', els.manageDialog).forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
    });
    $$('.tab-panel', els.manageDialog).forEach(function (panel) {
      panel.classList.toggle('is-active', panel.getAttribute('data-panel') === tab);
    });
    if (tab === 'data') updateStorageInfo();
  }

  function syncShopForm() {
    var r = state.restaurant;
    els.shopName.value = r.name || '';
    els.shopSub.value = r.subtitle || '';
    els.apiBase.value = storedApiBase();
  }

  function renderCatList() {
    if (!state.categories.length) {
      els.catList.innerHTML = '<p class="empty-line">还没有分类，先在下面添加一个。</p>';
      return;
    }
    els.catList.innerHTML = state.categories.map(function (cat, index) {
      var count = state.items.filter(function (it) { return it.categoryId === cat.id; }).length;
      return '<div class="cat-row" data-id="' + escapeHTML(cat.id) + '">' +
        '<input class="cat-name" type="text" maxlength="16" value="' + escapeHTML(cat.name) + '" aria-label="分类名称">' +
        '<span class="cat-count">' + count + ' 道</span>' +
        '<div class="cat-ops">' +
          '<button type="button" data-cat-up aria-label="上移"' + (index === 0 ? ' disabled' : '') + '><svg class="ico"><use href="#i-up"></use></svg></button>' +
          '<button type="button" data-cat-down aria-label="下移"' + (index === state.categories.length - 1 ? ' disabled' : '') + '><svg class="ico"><use href="#i-down"></use></svg></button>' +
          '<button type="button" class="del" data-cat-del aria-label="删除分类"><svg class="ico"><use href="#i-trash"></use></svg></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateStorageInfo() {
    var images = state.items.filter(function (it) { return it.image; }).length;
    els.storageText.textContent = '菜品 ' + state.items.length + ' 道 · 分类 ' + state.categories.length +
      ' 个 · 含图片 ' + images + ' 张 · 正在统计占用…';
    MenuDB.estimate().then(function (estimate) {
      var text = '菜品 ' + state.items.length + ' 道 · 分类 ' + state.categories.length +
        ' 个 · 含图片 ' + images + ' 张';
      if (estimate) {
        text += ' · 已用 ' + formatBytes(estimate.usage || 0) + (estimate.quota ? ' / 可用约 ' + formatBytes(estimate.quota) : '');
      }
      els.storageText.textContent = text;
    });
  }

  /* ---------- 确认弹窗 ---------- */

  function askConfirm(options) {
    options = options || {};
    return new Promise(function (resolve) {
      confirmResolve = resolve;
      els.confirmTitle.textContent = options.title || '确认操作';
      els.confirmMessage.textContent = options.message || '';
      els.confirmOk.textContent = options.confirmText || '确定';
      els.confirmOk.className = 'btn ' + (options.tone === 'primary' ? 'primary' : 'danger');
      if (!els.confirmDialog.open) els.confirmDialog.showModal();
    });
  }

  function settleConfirm(value) {
    var resolve = confirmResolve;
    confirmResolve = null;
    if (els.confirmDialog.open) els.confirmDialog.close();
    if (resolve) resolve(value);
  }

  /* ---------- 安装 ---------- */

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true;
  }

  function installGuideHTML() {
    var note = '微信、QQ 等内置浏览器通常无法安装，请先点右上角「在浏览器中打开」。';
    if (isIOS()) {
      return '<p class="install-title">iPhone / iPad</p>' +
        '<div class="install-step"><span class="step-num">1</span><div><strong>Safari 打开</strong><p>用 Safari 打开本页；如在微信内，请选择“在浏览器中打开”。</p></div></div>' +
        '<div class="install-step"><span class="step-num">2</span><div><strong>点「分享」</strong><p>点底部工具栏中间的分享图标。</p></div></div>' +
        '<div class="install-step"><span class="step-num">3</span><div><strong>添加到主屏幕</strong><p>选择「添加到主屏幕」，再点右上角「添加」。</p></div></div>' +
        '<p class="install-note">安装后以全屏 App 方式打开，并支持离线使用。' + note + '</p>';
    }
    return '<p class="install-title">Android</p>' +
      '<div class="install-step"><span class="step-num">1</span><div><strong>用浏览器打开</strong><p>推荐 Chrome 或系统自带浏览器。</p></div></div>' +
      '<div class="install-step"><span class="step-num">2</span><div><strong>打开浏览器菜单</strong><p>点右上角「⋮」，选择「安装应用」或「添加到主屏幕」。</p></div></div>' +
      '<div class="install-step"><span class="step-num">3</span><div><strong>确认安装</strong><p>桌面出现「味单」图标即完成，可离线全屏使用。</p></div></div>' +
      '<p class="install-note">' + note + ' 安装后可在「设置 → 数据与安装」随时查看本说明。</p>';
  }

  function updateInstallUI() {
    if (!els.installBtn) return;
    if (isStandalone()) {
      els.installHint.textContent = '当前已在 App 模式下运行，无需重复安装。';
      els.installBtn.hidden = true;
      return;
    }
    els.installBtn.hidden = false;
    if (deferredPrompt) {
      els.installHint.textContent = '这台设备支持一键安装，点击下方按钮即可添加到主屏幕。';
    } else if (isIOS()) {
      els.installHint.textContent = 'iPhone：Safari 打开本页 → 分享按钮 → 添加到主屏幕。';
    } else {
      els.installHint.textContent = '安卓：Chrome 打开本页 → 右上角菜单 → 安装应用 / 添加到主屏幕。';
    }
  }

  function installApp() {
    if (deferredPrompt) {
      var prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      Promise.resolve(prompt.userChoice).then(function (choice) {
        updateInstallUI();
        if (choice && choice.outcome === 'accepted') toast('正在安装到桌面…');
        else toast('已取消安装，可稍后再试');
      }).catch(function () { updateInstallUI(); });
      return;
    }
    els.installSteps.innerHTML = installGuideHTML();
    if (!els.installDialog.open) els.installDialog.showModal();
  }

  /* ---------- 数据导入导出 ---------- */

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function serializeImage(image) {
    if (!image) return Promise.resolve(null);
    if (typeof image === 'string') return Promise.resolve(image);
    return blobToDataURL(image);
  }

  function exportData() {
    Promise.all(state.items.map(function (item) {
      return serializeImage(item.image).then(function (image) {
        return Object.assign({}, item, { image: image });
      });
    })).then(function (items) {
      var payload = {
        app: '味单',
        version: 1,
        exportedAt: new Date().toISOString(),
        restaurant: state.restaurant,
        categories: state.categories,
        items: items
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      var date = new Date();
      var stamp = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
      a.href = URL.createObjectURL(blob);
      a.download = 'menu-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('备份已导出');
    }).catch(function (err) {
      console.error(err);
      toast('导出失败，请重试');
    });
  }

  function importData(file) {
    if (!file) return;
    file.text().then(function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('JSON 解析失败'); }
      var next = normalizeState(parsed);
      if (!next) throw new Error('数据结构不正确');
      return askConfirm({
        title: '导入备份',
        message: '导入会覆盖当前菜单、店铺信息和图片。确定继续吗？',
        confirmText: '导入',
        tone: 'primary'
      }).then(function (ok) {
        if (!ok) return false;
        state = next;
        currentCat = 'all';
        searchQuery = '';
        els.searchInput.value = '';
        return persist().then(function () {
          renderAll();
          syncShopForm();
          renderCatList();
          updateStorageInfo();
          toast('导入成功，共 ' + state.items.length + ' 道菜');
          return true;
        });
      });
    }).catch(function (err) {
      console.error(err);
      toast('文件格式不正确，请选择本应用导出的 JSON 备份', 3600);
    }).then(function () {
      els.importInput.value = '';
    });
  }

  function resetDemo() {
    askConfirm({
      title: '恢复示例菜单',
      message: '当前全部菜品、图片和店铺信息都会被清除，且无法撤销。',
      confirmText: '恢复示例',
      tone: 'danger'
    }).then(function (ok) {
      if (!ok) return;
      state = clone(DEMO);
      currentCat = 'all';
      searchQuery = '';
      els.searchInput.value = '';
      return persist().then(function () {
        renderAll();
        syncShopForm();
        renderCatList();
        updateStorageInfo();
        toast('已恢复示例菜单');
      });
    });
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    els.themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    els.settingsBtn.addEventListener('click', function () { openManage('shop'); });

    els.adminBtn.addEventListener('click', function () {
      setAdmin(!admin);
    });

    els.fabAdd.addEventListener('click', function () { openItemEditor(null); });

    els.searchInput.addEventListener('input', function () {
      searchQuery = els.searchInput.value;
      renderMenu();
    });
    els.searchInput.addEventListener('search', function () {
      searchQuery = els.searchInput.value;
      renderMenu();
    });

    els.cats.addEventListener('click', function (event) {
      var manage = event.target.closest('[data-manage-cats]');
      if (manage) { openManage('cats'); return; }
      var chip = event.target.closest('[data-cat]');
      if (!chip) return;
      currentCat = chip.getAttribute('data-cat');
      renderCats();
      renderMenu();
    });

    els.menu.addEventListener('click', function (event) {
      var editBtn = event.target.closest('[data-edit]');
      if (editBtn) { openItemEditor(editBtn.getAttribute('data-edit')); return; }
      var delBtn = event.target.closest('[data-del]');
      if (delBtn) { deleteItem(delBtn.getAttribute('data-del')); return; }
      var first = event.target.closest('[data-add-first]');
      if (first) { openItemEditor(null); return; }
      var openBtn = event.target.closest('[data-open]');
      if (openBtn) { openDish(openBtn.getAttribute('data-open')); return; }
      var thumb = event.target.closest('[data-view]');
      if (thumb) { openLightbox(thumb.getAttribute('data-view')); }
    });

    els.menu.addEventListener('error', function (event) {
      if (event.target && event.target.tagName === 'IMG') event.target.style.display = 'none';
    }, true);

    /* 菜品表单 */
    els.imagePicker.addEventListener('click', function (event) {
      if (event.target.closest('#removeImageBtn')) return;
      els.imageInput.click();
    });
    els.imagePicker.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        els.imageInput.click();
      }
    });
    els.removeImageBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      draftImage = null;
      updateImageUI();
    });
    els.imageInput.addEventListener('change', function () {
      var file = els.imageInput.files && els.imageInput.files[0];
      if (file) handleImageFile(file);
      els.imageInput.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      els.imagePicker.addEventListener(type, function (event) {
        event.preventDefault();
        els.imagePicker.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (type) {
      els.imagePicker.addEventListener(type, function (event) {
        event.preventDefault();
        els.imagePicker.classList.remove('is-dragover');
      });
    });
    els.imagePicker.addEventListener('drop', function (event) {
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });

    els.itemForm.addEventListener('submit', function (event) {
      event.preventDefault();
      saveItem();
    });
    els.fVideo.addEventListener('input', updateVideoPreview);
    els.fVideo.addEventListener('paste', function () {
      setTimeout(function () {
        var raw = els.fVideo.value;
        var url = StepTools.normalizeVideoUrl(raw);
        if (url && raw.trim() !== url) {
          els.fVideo.value = url;
          toast('已从分享文案中提取视频链接');
        }
        updateVideoPreview();
      }, 0);
    });
    els.fSteps.addEventListener('input', updateStepsCount);
    els.smartStepsBtn.addEventListener('click', openExtract);
    els.fetchVideoBtn.addEventListener('click', fetchVideoSteps);
    els.uploadVideoBtn.addEventListener('click', function () {
      if (!uploadLoading) els.videoFileInput.click();
    });
    els.videoFileInput.addEventListener('change', function () {
      var file = els.videoFileInput.files && els.videoFileInput.files[0];
      els.videoFileInput.value = '';
      if (file) uploadVideoSteps(file);
    });
    els.extractRunBtn.addEventListener('click', runExtract);
    els.applyStepsBtn.addEventListener('click', applyExtract);
    els.extractInput.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        runExtract();
      }
    });
    els.dishDialog.addEventListener('click', function (event) {
      var edit = event.target.closest('[data-dish-edit]');
      if (!edit) return;
      var id = edit.getAttribute('data-dish-edit');
      els.dishDialog.close();
      openItemEditor(id);
    });
    els.dishDialog.addEventListener('close', function () {
      els.dishContent.innerHTML = '';
    });
    els.itemDialog.addEventListener('close', function () {
      editingId = null;
      draftImage = null;
      els.itemForm.reset();
      els.imagePreview.removeAttribute('src');
      els.imagePreview.hidden = true;
      els.imagePicker.classList.remove('has-image', 'is-dragover', 'is-loading');
      els.removeImageBtn.hidden = true;
      els.videoPlatform.hidden = true;
      els.videoPlatform.textContent = '';
      els.videoPlatform.classList.remove('is-invalid');
      els.stepsCount.textContent = '0 步';
    });

    /* 管理面板 */
    $$('.tab', els.manageDialog).forEach(function (btn) {
      btn.addEventListener('click', function () { switchManageTab(btn.getAttribute('data-tab')); });
    });

    els.shopForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = els.shopName.value.trim();
      if (!name) { els.shopName.focus(); return; }
      state.restaurant = {
        name: name.slice(0, 30),
        subtitle: els.shopSub.value.trim().slice(0, 60)
      };
      try {
        var base = els.apiBase.value.trim().replace(/\/+$/, '');
        if (base) localStorage.setItem(API_BASE_KEY, base);
        else localStorage.removeItem(API_BASE_KEY);
      } catch (e) {}
      persist().then(function () {
        renderAll();
        syncShopForm();
        toast('店铺信息已保存');
      });
    });

    els.catList.addEventListener('change', function (event) {
      var input = event.target.closest('.cat-name');
      if (!input) return;
      var row = input.closest('.cat-row');
      var cat = state.categories.filter(function (c) { return c.id === row.getAttribute('data-id'); })[0];
      if (!cat) return;
      var name = input.value.trim();
      if (!name) { input.value = cat.name; toast('分类名称不能为空'); return; }
      if (cat.name === name) return;
      cat.name = name.slice(0, 16);
      persist().then(function () {
        renderAll();
        renderCatList();
        toast('分类已重命名');
      });
    });

    els.catList.addEventListener('click', function (event) {
      var row = event.target.closest('.cat-row');
      if (!row) return;
      var id = row.getAttribute('data-id');
      var index = state.categories.findIndex(function (c) { return c.id === id; });
      if (index < 0) return;

      if (event.target.closest('[data-cat-up]')) {
        if (index === 0) return;
        var prev = state.categories[index - 1];
        state.categories[index - 1] = state.categories[index];
        state.categories[index] = prev;
        persist().then(function () { renderAll(); renderCatList(); });
        return;
      }
      if (event.target.closest('[data-cat-down]')) {
        if (index === state.categories.length - 1) return;
        var next = state.categories[index + 1];
        state.categories[index + 1] = state.categories[index];
        state.categories[index] = next;
        persist().then(function () { renderAll(); renderCatList(); });
        return;
      }
      if (event.target.closest('[data-cat-del]')) {
        var cat = state.categories[index];
        var count = state.items.filter(function (it) { return it.categoryId === cat.id; }).length;
        askConfirm({
          title: '删除分类',
          message: count
            ? '「' + cat.name + '」下有 ' + count + ' 道菜，删除分类会一并删除这些菜品，且无法撤销。'
            : '确定删除「' + cat.name + '」这个分类吗？',
          confirmText: '删除'
        }).then(function (ok) {
          if (!ok) return;
          state.categories = state.categories.filter(function (c) { return c.id !== cat.id; });
          state.items = state.items.filter(function (it) { return it.categoryId !== cat.id; });
          if (currentCat === cat.id) currentCat = 'all';
          return persist().then(function () {
            renderAll();
            renderCatList();
            updateStorageInfo();
            toast('分类已删除');
          });
        });
      }
    });

    els.addCatBtn.addEventListener('click', function () {
      var name = els.newCatInput.value.trim();
      if (!name) { els.newCatInput.focus(); return; }
      if (state.categories.some(function (c) { return c.name === name; })) {
        toast('已经有同名分类了');
        return;
      }
      state.categories.push({ id: uid(), name: name.slice(0, 16) });
      els.newCatInput.value = '';
      persist().then(function () {
        renderAll();
        renderCatList();
        toast('分类已添加');
      });
    });
    els.newCatInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); els.addCatBtn.click(); }
    });

    /* 数据与安装 */
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', function () { els.importInput.click(); });
    els.importInput.addEventListener('change', function () {
      var file = els.importInput.files && els.importInput.files[0];
      if (file) importData(file);
    });
    els.resetBtn.addEventListener('click', resetDemo);
    els.installBtn.addEventListener('click', installApp);

    /* 确认弹窗 */
    els.confirmOk.addEventListener('click', function () { settleConfirm(true); });
    els.confirmCancel.addEventListener('click', function () { settleConfirm(false); });
    els.confirmDialog.addEventListener('close', function () {
      if (confirmResolve) settleConfirm(false);
    });

    /* 大图 */
    els.lightbox.addEventListener('close', function () {
      els.lightboxImg.removeAttribute('src');
      els.lightboxCaption.textContent = '';
    });

    /* 通用关闭 */
    document.addEventListener('click', function (event) {
      var closer = event.target.closest('[data-close-dialog]');
      if (closer) {
        var dialog = closer.closest('dialog');
        if (dialog) dialog.close();
        return;
      }
      if (event.target.tagName === 'DIALOG') event.target.close();
    });

    /* 安装事件 */
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallUI();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      updateInstallUI();
      toast('已安装到桌面，像 App 一样打开吧');
    });
  }

  function saveItem() {
    var name = els.fName.value.trim();
    if (!name) { els.fName.focus(); return; }
    if (!state.categories.length) {
      state.categories.push({ id: uid(), name: '未分类' });
      buildCategoryOptions(state.categories[0].id);
    }
    var categoryId = els.fCategory.value;
    if (!state.categories.some(function (c) { return c.id === categoryId; })) {
      categoryId = state.categories[0].id;
    }
    var tags = els.fTags.value.split(/[,，、;；\s]+/).filter(Boolean).slice(0, 6).map(function (tag) {
      return tag.slice(0, 12);
    });
    var videoRaw = els.fVideo.value.trim();
    var video = videoRaw ? StepTools.normalizeVideoUrl(videoRaw) : '';
    if (videoRaw && !video) {
      toast('视频链接格式不正确，请粘贴完整的 http(s) 链接');
      els.fVideo.focus();
      return;
    }
    var payload = {
      categoryId: categoryId,
      name: name.slice(0, 40),
      desc: els.fDesc.value.trim().slice(0, 120),
      tags: tags,
      image: draftImage,
      video: video,
      steps: stepsFromField(),
      available: els.fAvailable.checked
    };
    var wasEditing = Boolean(editingId);

    if (wasEditing) {
      var item = state.items.filter(function (it) { return it.id === editingId; })[0];
      if (!item) return;
      Object.assign(item, payload);
    } else {
      state.items.push(Object.assign({ id: uid() }, payload));
      currentCat = categoryId;
      searchQuery = '';
      els.searchInput.value = '';
    }

    persist().then(function () {
      els.itemDialog.close();
      renderAll();
      toast(wasEditing ? '菜品已保存' : '已添加「' + name.slice(0, 40) + '」');
    });
  }

  function deleteItem(id) {
    var item = state.items.filter(function (it) { return it.id === id; })[0];
    if (!item) return;
    askConfirm({
      title: '删除菜品',
      message: '确定删除「' + item.name + '」吗？此操作无法撤销。',
      confirmText: '删除'
    }).then(function (ok) {
      if (!ok) return;
      state.items = state.items.filter(function (it) { return it.id !== id; });
      return persist().then(function () {
        renderAll();
        updateStorageInfo();
        toast('已删除「' + item.name + '」');
      });
    });
  }

  function openLightbox(id) {
    var item = state.items.filter(function (it) { return it.id === id; })[0];
    var src = item ? imageSrc(item.image) : '';
    if (!src) return;
    els.lightboxImg.src = src;
    els.lightboxImg.alt = item.name;
    els.lightboxCaption.textContent = item.name;
    if (!els.lightbox.open) els.lightbox.showModal();
  }

  /* ---------- 菜品详情 ---------- */

  function dishHTML(item) {
    var cat = state.categories.filter(function (c) { return c.id === item.categoryId; })[0];
    var name = escapeHTML(item.name);
    var src = imageSrc(item.image);
    var initial = escapeHTML((item.name || '菜').trim().slice(0, 1));
    var platform = item.video ? StepTools.platformOf(item.video) : null;

    var tags = (item.tags || []).map(function (tag) {
      return '<span class="tag">' + escapeHTML(tag) + '</span>';
    }).join('');
    var status = item.available === false
      ? '<span class="dish-status">今日售罄</span>'
      : '<span class="dish-status is-ok">供应中</span>';

    var hero = '<div class="dish-hero' + (src ? '' : ' no-image') + '">' +
      (src ? '<img src="' + escapeHTML(src) + '" alt="' + name + '">' : '<div class="ph"><span>' + initial + '</span></div>') +
      '<div class="dish-hero-mask"></div>' +
      '<div class="dish-hero-text">' +
        '<p class="dish-cat">' + escapeHTML(cat ? cat.name : '未分类') + '</p>' +
        '<h2 id="dishDialogTitle">' + name + '</h2>' +
        '<div class="dish-hero-meta">' + status + '</div>' +
      '</div>' +
    '</div>';

    var videoHTML = item.video
      ? '<a class="video-card" href="' + escapeHTML(item.video) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="video-icon"><svg class="ico"><use href="#i-play"></use></svg></span>' +
          '<span class="video-info"><strong>' + escapeHTML(platform ? platform.label : '视频') + ' 制作视频</strong>' +
          '<em>点击前往原平台观看</em></span>' +
          '<svg class="ico video-go"><use href="#i-external"></use></svg>' +
        '</a>'
      : '';

    var stepsHTML = item.steps && item.steps.length
      ? '<ol class="step-list">' + item.steps.map(function (step, index) {
          return '<li><span class="dish-step-num">' + (index + 1) + '</span><p>' + escapeHTML(step) + '</p></li>';
        }).join('') + '</ol>'
      : '<p class="dish-empty-note">还没有制作步骤。开启管理模式，编辑这道菜即可添加。</p>';

    var actions = admin
      ? '<div class="dish-actions"><button class="btn primary" type="button" data-dish-edit="' + escapeHTML(item.id) + '">' +
        '<svg class="ico"><use href="#i-edit"></use></svg>编辑这道菜</button></div>'
      : '';

    return '<div class="dish-scroll-inner">' + hero +
      '<div class="dish-body">' +
        (item.desc ? '<p class="dish-desc">' + escapeHTML(item.desc) + '</p>' : '') +
        (tags ? '<div class="dish-tags">' + tags + (item.video ? '<span class="tag video-tag">视频</span>' : '') + '</div>' : '') +
        '<section class="dish-section"><h3><svg class="ico"><use href="#i-play"></use></svg>制作视频</h3>' +
          (videoHTML || '<p class="dish-empty-note">还没有制作视频，编辑菜品可粘贴抖音、小红书等链接。</p>') +
        '</section>' +
        '<section class="dish-section"><h3><svg class="ico"><use href="#i-list"></use></svg>制作步骤<span class="section-count">' +
          (item.steps ? item.steps.length : 0) + ' 步</span></h3>' +
          stepsHTML +
        '</section>' +
        actions +
      '</div>' +
    '</div>';
  }

  function openDish(id) {
    var item = state.items.filter(function (it) { return it.id === id; })[0];
    if (!item) return;
    els.dishContent.innerHTML = dishHTML(item);
    if (!els.dishDialog.open) els.dishDialog.showModal();
    els.dishContent.scrollTop = 0;
  }

  /* ---------- 启动 ---------- */

  function registerSW() {
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn('Service worker 注册失败', err);
      });
    }
  }

  function maybeFirstRunTip() {
    try {
      if (localStorage.getItem(TIP_KEY)) return;
      setTimeout(function () {
        toast('点右上角「管理」，即可添加菜品和图片', 3600);
        localStorage.setItem(TIP_KEY, '1');
      }, 1600);
    } catch (e) {}
  }

  function init() {
    cacheElements();
    bindEvents();

    var theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(theme);

    MenuDB.load().then(function (saved) {
      state = normalizeState(saved) || clone(DEMO);
    }).catch(function (err) {
      console.warn('读取本地菜单失败', err);
      state = clone(DEMO);
      toast('无法读取本地存储，本次修改可能无法保存', 4000);
    }).then(function () {
      if (!state.categories.length) state.categories.push({ id: uid(), name: '未分类' });
      renderAll();
      updateInstallUI();
      registerSW();
      maybeFirstRunTip();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
