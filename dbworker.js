var m_db = null;
var m_dbName = "osmcachedatabase";
var m_dbVersion = 1;
var m_storeName = "tilecache";
var m_keyName = "zyx";
var m_valueName = "blob";
var m_getOperation = "get";
var m_setOperation = "set";
var m_openOperation = "open";
var m_openErrorOperation = "openerror";
var m_operations = [ ];
var m_objectStore = null;
var m_transactionBusy = false;

onmessage = function(e)
{
    var obj = e.data;
    console.log("Thread received:");
    console.log(obj);

    if (obj.type == m_openOperation)
        setTimeout(openDatabase, 0);
    else if (obj.type == m_getOperation || obj.type == m_setOperation)
    {
        m_operations.push(obj);
        setTimeout(startTransactions, 0);
    }
    else
        console.log("Error: unknown object type in thread: " + obj.type);
}

function openDatabase()
{
    var r = indexedDB.open(m_dbName, m_dbVersion);
    r.onsuccess = function()
    {
        console.log("got database");
        m_db = r.result;
        postMessage({ type: m_openOperation }); // let the main thread know we're done
    }
    r.onupgradeneeded = function(event) 
    {
        console.log("onupgradeneeded");
        var db = event.target.result;
        var objectStore = db.createObjectStore(m_storeName, { keyPath: m_keyName });
    }
    r.onerror = function(event)
    {
        r.onerror = null;
        if (!m_db) // check that it's not a bubbled event
            postMessage({ type: m_openErrorOperation, evt: event }); // let the main thread know
    }
}

function startTransactions()
{
    if (m_operations.length == 0)
    {
        m_objectStore = null;
        return;
    }
    if (m_transactionBusy)
        return;

    var transObj = m_operations.splice(0, 1)[0];
    if (m_objectStore == null)
    {
        //console.log("Opening objectStore");
        m_objectStore = m_db.transaction([m_storeName], "readwrite").objectStore(m_storeName);
    }
    else
    {
        //console.log("Reusing objectStore")
    }

    if (transObj.type == m_getOperation)
    {
        //console.log("Scheduling get");
        m_transactionBusy = true;
        var r = m_objectStore.get(transObj.key);
        r.onsuccess = function(evt)
        {
            m_transactionBusy = false;

            //console.log("get complete");
            var blob = null;
            var obj = evt.target.result;
            if (!obj)
                blob = null;
            else
            {
                blob = obj[m_valueName];
                console.log("Retrieved blob for " + transObj.key);
                //console.log(blob);
            }

            transObj.blob = blob;
            postMessage(transObj);

            if (m_operations.length == 0)
            {
                m_objectStore = null;
                //console.log("Set objectStore to null");
            }
            else
                startTransactions();
        }
    }
    else if (transObj.type == m_setOperation)
    {
        //console.log("Scheduling set");
        m_transactionBusy = true;

        var obj = { }
        obj[m_valueName] = transObj.value;
        obj[m_keyName] = transObj.key;
        var r = m_objectStore.put(obj);

        r.onsuccess = function()
        {
            m_transactionBusy = false;

            //console.log("set complete");
            console.log("Saved " + transObj.key + " in database");

            postMessage(transObj);

            if (m_operations.length == 0)
            {
                m_objectStore = null;
                //console.log("Set objectStore to null");
            }
            else
                startTransactions();
        }
    }
    else
        throw "Internal error: Unknown transaction type " + transObj.type;
}

