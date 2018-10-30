// META: script=support-promises.js

/**
 * This file contains the webplatform tests for the explicit commit() method
 * of the IndexedDB transaction API.
 *
 * @author andreasbutler@google.com
 */

setup({allow_uncaught_exception:true});

promise_test( async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  await new Promise((resolve, reject) => {
    objStore.put({isbn: "five", title: "hey"});
    objStore.put({isbn: "four", title: "hee"});
    objStore.put({isbn: "three", title: "hum"});
    txn.oncomplete = () => {
      resolve();
    }
    txn.onerror = () => {
      reject();
    }
    txn.commit();
  });
  const txn2 = db.transaction(['books'], 'readwrite');
  const objStore2 = txn2.objectStore('books');
  const ret = await new Promise((resolve, reject) => {
    const ret1 = objStore2.get("five");
    const ret2 = objStore2.get("four");
    const ret3 = objStore2.get("three");
    txn2.oncomplete = () => {
      resolve([ret1.result.title,
          ret2.result.title,
          ret3.result.title]);
    }
    txn2.onerror = () => {
      reject();
    }
    txn2.commit();
  });
  assert_array_equals(ret, ["hey","hee","hum"],
      "Get operation did not retrieve all expected results");
}, "Ensure explicitly committed data can be read back out.");


promise_test( async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  txn.commit();
  assert_throws('TransactionInactiveError',
      () => { objStore.put({isbn: "hey", title: "you"}); },
      "After commit is called, the transaction should be inactive.");
}, "Ensure a committed transaction is blocked immediately.");


promise_test( async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  await new Promise((resolve, reject) => {
    const req = objStore.put({isbn: "hey", title: "you"});
    txn.commit();
    req.onsuccess = ()=>{
      resolve(new Promise((resolve, reject) => {
        assert_throws('TransactionInactiveError',
            ()=>{ objStore.put({isbn:"hee", title:"yay"}); },
            "The transaction should not be active in a request's callback after commit() is called.");
        resolve();
      }));
    }
  });
}, "Ensure a committed transaction is blocked in future request callbacks.");


promise_test( async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  txn.commit();
  try {
    const put_req = objStore.put({isbn:"york", title:"monx"});
  } catch(err) {
    const res = await new Promise((resolve, reject) => {
      const txn2 = db.transaction(['books'], 'readonly');
      const objStore2 = txn2.objectStore('books');
      const get_req = objStore2.get('york');
      get_req.onsuccess = () => {
        resolve(get_req.result);
      }
      get_req.onerror = () => {
        reject();
      }
    });
    assert_equals(res, undefined);
  }
}, "Ensure that puts issued after commit don't put anything.");


promise_test( async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  txn.abort();
  assert_throws('InvalidStateError',
      ()=>{ txn.commit(); },
      "The transaction should have been aborted.");

}, "Ensure that calling commit on an aborted transaction throws.");


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  txn.commit();
  assert_throws('InvalidStateError',
      ()=>{ txn.commit(); },
      "The transaction should already have committed.");
}, "Ensure that calling commit on a committed transaction throws.");


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objStore = txn.objectStore('books');
  put_req = objStore.put({isbn:"twilight", title:"series"});
  txn.commit();
  assert_throws('InvalidStateError',
      ()=>{ txn.abort(); },
      "The transaction should already have committed.");
  const txn2 = db.transaction(['books'], 'readwrite');
  const objStore2 = txn2.objectStore('books');
  res = await new Promise((resolve, reject) => {
    get_req = objStore2.get("twilight");
    get_req.onsuccess = ()=>{
      resolve(get_req.result);
    }
    get_req.onerror = () => {
      reject();
    }
  });
  assert_equals(res.title, 'series', "Expected the result to be retrievable");
}, "Ensure that calling abort on a committed transaction throws and data is still committed.");


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });
  await new Promise((resolve, reject) => {
    const txn = db.transaction(['books'], 'readwrite');
    const objectStore = txn.objectStore('books');
    const put_req = objectStore.put({isbn:"yangle", title:"yorngle"});
    txn.commit();
    put_req.onsuccess = () => {
      throw "an error";
    }
    txn.oncomplete = () => {
      resolve();
    }
  });
  res = await new Promise((resolve, reject) => {
    const txn2 = db.transaction(['books'], 'readwrite');
    const objectStore2 = txn2.objectStore('books');
    const get_req = objectStore2.get('yangle');
    get_req.onsuccess = () => {
      resolve(get_req.result);
    }
  });
  assert_equals(res.title, 'yorngle');
}, "Ensure that any errors in callbacks won't stop an explicit commit from continuing.");


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });

  await new Promise((resolve, reject)=> {
    const txn = db.transaction(['books'], 'readwrite');
    const objectStore = txn.objectStore('books');
    const put_req = objectStore.put({isbn:"clip", title:"clop"});

    setTimeout(()=>{
      assert_throws('InvalidStateError',
          () => { txn.commit(); },
          "The transaction should be inactive so commit should be uncallable.");
      resolve();
    }, 0);
  });

}, "Calling txn.commit() when txn is inActive should throw.");
