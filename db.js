var DB = function()
{
    var _this = this;
    var m_worker = new Worker("dbworker.js");
    var m_dbVersion = 1;

    var m_getOperation = "get";
    var m_setOperation = "set";
    var m_openOperation = "open";
    var m_openErrorOperation = "openerror";

    var m_operations = { };

    this.onopenerror = function(evt) { }
    this.onopen = function() { }

    var getIdentifier = function(len)
    {
        var str = "";
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for(var i = 0 ; i < len ; i++ )
            str += chars.charAt(Math.floor(Math.random() * chars.length));

        return str;
    }

    m_worker.onmessage = function(e)
    {
        var obj = e.data;
        var id = obj.internalId;
        var operation = { };

        console.log("Main thread received:");
        console.log(obj);

        if (id in m_operations)
        {
            operation = m_operations[id];
            delete m_operations[id];
        }

        if (obj.type == m_openErrorOperation)
            setTimeout(function() { _this.onopenerror(obj.evt); }, 0);
        else if (obj.type == m_openOperation)
            setTimeout(function() { _this.onopen(); }, 0);
        else if (obj.type == m_setOperation)
        {
            if ("callback" in operation)
                setTimeout(function() { operation.callback() }, 0);
        }
        else if (obj.type == m_getOperation)
        {
            if ("callback" in operation)
                setTimeout(function() { operation.callback(obj.blob) }, 0);
        }
        else
            console.log("Error: unexpected object type " + obj.type);
    }

    var queueOperation = function(obj)
    {
        var id = getIdentifier(16);
        var operation = { id: id };
        obj.internalId = id;

        if ("callback" in obj && obj.callback)
        {
            operation.callback = obj.callback;
            delete obj.callback; // can't clone this, don't send it to the thread
        }

        m_operations[id] = operation;

        m_worker.postMessage(obj);
    }

    this.getEntry = function(key, callback)
    {
        queueOperation({ type: m_getOperation, callback: callback, key: key });
    }

    this.storeEntry = function(key, blob, callback)
    {
        queueOperation({ type: m_setOperation, callback: callback, value: blob, key: key });
    }

    var constructor = function()
    {
        queueOperation({ type: "open" });
    }

    setTimeout(constructor, 0);
}
