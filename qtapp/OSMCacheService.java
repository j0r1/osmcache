package org.qtproject.qosmcache;

import android.content.Intent;
import org.qtproject.qt5.android.bindings.QtService;
import android.util.Log;
import android.os.Vibrator;
import android.content.Context;

public class OSMCacheService extends QtService {

	private static OSMCacheService m_instance = null;

	public OSMCacheService() 
	{
		m_instance = this;
	}

	public static void vibrate() 
	{
		if (m_instance == null)
			return;

		Vibrator v = (Vibrator)m_instance.getSystemService(Context.VIBRATOR_SERVICE);	
		v.vibrate(500);
	}
}
