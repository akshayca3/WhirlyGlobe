package com.mousebirdconsulting.maply;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class QuadPagingLayer extends Layer implements LayerThread.ViewWatcherInterface
{
	/**
	 * This is the interface paging delegates must fill in.
	 * You'll get called back on the startFetchForTile on whatever thread
	 * grabs our fancy.
	 *
	 * @author sjg
	 *
	 */
	public interface PagingInterface
	{
		public int minZoom();
		public int maxZoom();
		public void startFetchForTile(QuadPagingLayer layer,MaplyTileID tileID);
	}
	
	CoordSystem coordSys = null;
	PagingInterface pagingDelegate = null;
	
	QuadPagingLayer(CoordSystem inCoordSys,PagingInterface inDelegate)
	{
		coordSys = inCoordSys;
		pagingDelegate = inDelegate;
		initialise(coordSys,pagingDelegate);
	}
	
	public void finalize()
	{
		dispose();
	}
	
	@Override
	public float getMinTime() 
	{
		// Update every 1/10s
		return 0.1f;
	}

	@Override
	public float getMaxLagTime() 
	{
		// Want an update no less often than this
		// Note: What?
		return 4.0f;
	}	

	Handler evalStepHandle = null;
	Runnable evalStepRun = null;

	// Called when the layer is ready to start doing things
	public void startLayer(LayerThread layerThread)
	{
		super.startLayer(layerThread);
		layerThread.addWatcher(this);
		Point2d ll = new Point2d(coordSys.ll.getX(),coordSys.ll.getY());
		Point2d ur = new Point2d(coordSys.ur.getX(),coordSys.ur.getY());
		nativeStartLayer(layerThread.scene,layerThread.renderer,ll,ur,pagingDelegate.minZoom(),pagingDelegate.maxZoom());
	}
	
	// Called when the layer shuts down.  Won't be run again.
	public void shutdown()
	{
		cancelEvalStep();
		nativeShutdown();
		super.shutdown();
	}

	// View state was updated (filtered through our schedule)
	@Override
	public void viewUpdated(ViewState viewState) 
	{
		nativeViewUpdate(viewState);

		scheduleEvalStep();
	}
	
	// Cancel the current evalStep
	void cancelEvalStep()
	{
		if (evalStepHandle != null)
		{
			evalStepHandle.removeCallbacks(evalStepRun);
			evalStepHandle = null;
			evalStepRun = null;
		}		
	}
	
	// Cancel the current evalStep and post a new one
	void scheduleEvalStep()
	{
		cancelEvalStep();
		
		evalStepRun = new Runnable()
		{
			@Override
			public void run()
			{
				evalStep();
			}
		};
		evalStepHandle = new Handler();
		evalStepHandle.post(evalStepRun);		
	}
	
	// Do something small and then return
	void evalStep()
	{
		evalStepHandle = null;
		evalStepRun = null;
		
		// Note: Check that the renderer is set up and such.
		
		boolean didSomething = nativeEvalStep();
		if (didSomething)
			scheduleEvalStep();
	}
	
	// Caller wants us to reload everything
	public void refresh()
	{
		// Make sure this runs on the layer thread
		if (Looper.myLooper() != layerThread.getLooper())
		{
			Handler handle = new Handler();
			handle.post(
					new Runnable() 
					{
						@Override
						public void run()
						{
							refresh();
						}
					});
			return;
		}
		
		boolean doEvalStep = nativeRefresh();
		if (doEvalStep)
			scheduleEvalStep();
	}
	
	// Called by the native side when it's time to load a tile
	public void loadTile(int x,int y,int level)
	{
		Log.i("QuadPagingLayer","Load tile: " + level + "(" + x + "," + y + ")");
	}
	
	// Called by the native side when it's time to unload a tile
	public void unloadTile(int x,int y,int level)
	{
		Log.i("QuadPagingLayer","Unload tile: " + level + "(" + x + "," + y + ")");		
	}

	// Note: Missing wakeUp

	public native void initialise(CoordSystem coordSys,PagingInterface pagingDelegate);
	public native void dispose();
	private long nativeHandle;

	native void nativeStartLayer(MapScene scene,MaplyRenderer renderer,Point2d ll,Point2d ur,int minZoom,int maxZoom);
	native void nativeShutdown();
	native void nativeViewUpdate(ViewState viewState);	
	native boolean nativeEvalStep();
	native boolean nativeRefresh();
}