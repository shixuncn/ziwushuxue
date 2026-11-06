/* 轻量 IndexedDB 封装：整份菜单作为一个记录保存，图片以 Blob 形式随记录存储 */
(function () {
  'use strict';

  var DB_NAME = 'weidan-menu';
  var DB_VERSION = 1;
  var STORE = 'state';
  var KEY = 'menu';
  var dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        if (!('indexedDB' in window)) {
          reject(new Error('当前浏览器不支持 IndexedDB'));
          return;
        }
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('打开数据库失败')); };
        req.onblocked = function () { reject(new Error('数据库被其他标签页占用')); };
      });
    }
    return dbPromise;
  }

  function load() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = function () { resolve(req.result == null ? null : req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function save(data) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(data, KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('写入中止')); };
      });
    });
  }

  function estimate() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().catch(function () { return null; });
  }

  window.MenuDB = { load: load, save: save, estimate: estimate, open: open };
})();
