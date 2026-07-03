// Classic-script IndexedDB get/set, loaded via importScripts() by every app's own service
// worker (a worker can't `import` an ES module). This is the raw open/get/put boilerplate
// each app's notify.js used to hand-copy — now written once and shared, mirroring the
// page-context src/shared/notify/idbKv.ts.
function sharedNotifyOpenDb(dbName, storeName) {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = function () { req.result.createObjectStore(storeName); };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

self.sharedNotifyIdb = {
  get: function (dbName, storeName, key) {
    return sharedNotifyOpenDb(dbName, storeName).then(function (db) {
      return new Promise(function (resolve) {
        var r = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { resolve(undefined); };
      });
    }).catch(function () { return undefined; });
  },
  set: function (dbName, storeName, key, value) {
    return sharedNotifyOpenDb(dbName, storeName).then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    }).catch(function () {});
  },
};
