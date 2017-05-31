var DB = function()
{
    var _this = this;
    var m_dbVersion = 1;
    var m_dbName = "osmcachedatabase";
    var m_storeName = "tilecache";
    var m_keyName = "zyx";
    var m_valueName = "blob";
    var m_db = null;
    var m_getOperation = "get";
    var m_setOperation = "set";
    var m_operations = [ ];
    var m_objectStore = null;
    var m_transactionBusy = false;
    var m_maxGetSetBeforeFlush = 30;
    var m_getSetCount = 0;

    this.onopenerror = function(evt) { }
    this.onopen = function() { }

    var startTransactions = function()
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

                if (transObj.callback)
                    setTimeout(function() { transObj.callback(blob); }, 0);

                m_getSetCount++;
                if (m_operations.length == 0)
                {
                    m_objectStore = null;
                    //console.log("Set objectStore to null");
                }
                else if (m_getSetCount >= m_maxGetSetBeforeFlush)
                {
                    // This should end the current transaction, causing a flush
                    m_getSetCount = 0;
                    m_objectStore = null;
                    setTimeout(startTransactions, 0);
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
                if (transObj.callback)
                    setTimeout(function() { transObj.callback(); }, 0);

                m_getSetCount++;
                if (m_operations.length == 0)
                {
                    m_objectStore = null;
                    //console.log("Set objectStore to null");
                }
                else if (m_getSetCount >= m_maxGetSetBeforeFlush)
                {
                    // This should end the current transaction, causing a flush
                    m_getSetCount = 0;
                    m_objectStore = null;
                    setTimeout(startTransactions, 0);
                }
                else
                    startTransactions();
            }
        }
        else
            throw "Internal error: Unknown transaction type " + transObj.type;
    }

    var queueOperation = function(obj)
    {
        m_operations.push(obj);
        if (m_objectStore == null) // if no transaction is busy yet, we'll start one
            setTimeout(startTransactions, 0);
    }

    this.getEntry = function(key, callback)
    {
        if (!m_db)
            throw "Database is not available (yet)";

        queueOperation({ type: m_getOperation, callback: callback, key: key });
    }

    this.storeEntry = function(key, blob, callback)
    {
        if (!m_db)
            throw "Database is not available (yet)";

        queueOperation({ type: m_setOperation, callback: callback, value: blob, key: key });
    }

    var constructor = function()
    {
        var r = indexedDB.open(m_dbName, m_dbVersion);
        r.onsuccess = function()
        {
            console.log("got database");
            m_db = r.result;
            setTimeout(function() { _this.onopen(); }, 0);
        }
        r.onupgradeneeded = function(event) 
        {
            console.log("onupgradeneeded");
            var db = event.target.result;
            var objectStore = db.createObjectStore(m_storeName, { keyPath: m_keyName });
        }
        r.onerror = function(evt)
        {
            r.onerror = null;
            if (!m_db) // check that it's not a bubbled event
                setTimeout(function() { _this.onopenerror(evt); }, 0);
        }
    }

    setTimeout(constructor, 0);
}
