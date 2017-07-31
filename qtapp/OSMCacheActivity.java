package org.qtproject.qosmcache;

import org.qtproject.qt5.android.bindings.QtActivity;
import org.qtproject.qosmcache.OSMCacheService;
import android.content.Intent;
import android.util.Log;
import android.os.Bundle;

public class OSMCacheActivity extends QtActivity {
    @Override
    public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        Log.i("Activity", "Starting service!");
        Intent serviceIntent = new Intent(this, org.qtproject.qosmcache.OSMCacheService.class);
        startService(serviceIntent);
    }
}

