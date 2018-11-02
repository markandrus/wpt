// META: title=StorageManager: estimate() for indexeddb

promise_test(t => {
  return navigator.storage.estimate().then(result => {
    assert_equals(typeof result.breakdown, 'object');
  });
}, 'estimate() resolves to dictionary with usage breakdown member');

promise_test(async t => {
  const arraySize = 1e6;
  const objectStoreName = "storageManager";
  const dbname = this.window ? window.location.pathname :
        "estimate-worker.https.html";

  let usageBeforeCreate, usageAfterCreate, usageAfterPut;

  function deleteDB(name) {
    return new Promise((resolve, reject) => {
      let deleteRequest = indexedDB.deleteDatabase(window.location.pathname);
      deleteRequest.onerror = () => { reject(deleteRequest.error); };
      deleteRequest.onsuccess = () => { resolve(); };
    });
  }

  await deleteDB(dbname);
  let estimate = await navigator.storage.estimate();
  usageBeforeCreate = estimate.usage;
  breakdownUsageBeforeCreate = estimate.breakdown.IndexedDb;

  assert_equals(usageBeforeCreate, breakdownUsageBeforeCreate,
    'breakdown should match usage before object store is created');

  const db = await new Promise((resolve, reject) => {
    let openRequest = indexedDB.open(dbname);
    t.add_cleanup(() => {
      deleteDB(dbname);
    });

    openRequest.onerror = () => { reject(openRequest.error); };
    openRequest.onupgradeneeded = event => {
      openRequest.result.createObjectStore(objectStoreName);
    };
    openRequest.onsuccess = () => { resolve(openRequest.result); };
  });

  estimate = await navigator.storage.estimate();
  usageAfterCreate = estimate.usage;
  breakdownUsageAfterCreate = estimate.breakdown.IndexedDb;

  assert_equals(usageAfterCreate, breakdownUsageAfterCreate,
    'breakdown should match usage after object store is created');
  assert_greater_than(
    usageAfterCreate, usageBeforeCreate,
    'estimated usage should increase after object store is created');

  let txn = db.transaction(objectStoreName, 'readwrite');
  let buffer = new ArrayBuffer(arraySize);
  let view = new Uint8Array(buffer);

  for (let i = 0; i < arraySize; i++) {
    view[i] = parseInt(Math.random() * 255);
  }

  let testBlob = new Blob([buffer], {type: "binary/random"});
  txn.objectStore(objectStoreName).add(testBlob, 1);

  await new Promise((resolve, reject) => {
    txn.onabort = () => { reject(txn.error); };
    txn.oncomplete = () => { resolve(); };
  });

  estimate = await navigator.storage.estimate();
  usageAfterPut = estimate.usage;
  breakdownUsageAfterPut = estimate.breakdown.IndexedDb;

  assert_equals(usageAfterPut, breakdownUsageAfterPut,
    'breakdown should match usage after large value is stored');
  assert_greater_than(
    usageAfterPut, usageAfterCreate,
    'estimated usage should increase after large value is stored');

  db.close();
}, 'estimate() usage breakdown reflects increase after large value is stored');
