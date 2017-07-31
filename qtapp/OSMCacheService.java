package org.qtproject.qosmcache;

import android.content.Intent;
import org.qtproject.qt5.android.bindings.QtService;
import android.util.Log;

public class OSMCacheService extends QtService {

   @Override
   public void onCreate() {
      super.onCreate();
      Log.i("Service", "Service created!");
   }

   /** The service is starting, due to a call to startService() */
   @Override
   public int onStartCommand(Intent intent, int flags, int startId) {
      int ret = super.onStartCommand(intent, flags, startId);
      Log.i("Service", "Service created!");
      return ret;
   }
}
