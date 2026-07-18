(() => {
  const MAP_REFIT_PADDING = [54, 54];
  let scheduledFrame = 0;
  let needsRefit = false;
  let resizeObserver = null;
  let stabilizationTimeouts = [];
  let userInteracted = false;

  function clearStabilizationTimeouts() {
    stabilizationTimeouts.forEach(timeoutId => window.clearTimeout(timeoutId));
    stabilizationTimeouts = [];
  }

  function stabilizeMap({ refit = false, forceRefit = false } = {}) {
    if (typeof map === 'undefined' || !map) return;

    if (refit && (forceRefit || !userInteracted)) {
      needsRefit = true;
    }

    if (scheduledFrame) return;

    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = 0;
      const performRefit = needsRefit;
      needsRefit = false;

      map.invalidateSize({ animate: false, pan: false });

      if (performRefit && typeof corridorLayer !== 'undefined' && corridorLayer) {
        const bounds = corridorLayer.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: MAP_REFIT_PADDING, animate: false });
        }
      }
    });
  }

  function runStabilizationSequence({ forceRefit = false } = {}) {
    clearStabilizationTimeouts();

    stabilizeMap({ refit: true, forceRefit });
    stabilizationTimeouts.push(window.setTimeout(() => stabilizeMap({ refit: true, forceRefit }), 120));
    stabilizationTimeouts.push(window.setTimeout(() => stabilizeMap({ refit: true, forceRefit }), 420));
    stabilizationTimeouts.push(window.setTimeout(() => stabilizeMap({ refit: false }), 900));
  }

  function observeMapContainer() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver(() => stabilizeMap({ refit: false }));
    resizeObserver.observe(mapElement);
  }

  function recordUserInteraction() {
    userInteracted = true;
  }

  window.addEventListener('load', () => runStabilizationSequence({ forceRefit: true }), { once: true });
  window.addEventListener('pageshow', () => runStabilizationSequence({ forceRefit: true }));
  window.addEventListener('resize', () => stabilizeMap({ refit: false }), { passive: true });
  window.addEventListener('orientationchange', () => {
    clearStabilizationTimeouts();
    stabilizationTimeouts.push(window.setTimeout(() => runStabilizationSequence({ forceRefit: true }), 250));
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => stabilizeMap({ refit: false }), { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) runStabilizationSequence();
  });

  const drawer = document.querySelector('.control-drawer');
  if (drawer) {
    drawer.addEventListener('transitionend', event => {
      if (event.propertyName === 'transform') stabilizeMap({ refit: false });
    });
  }

  const waitForMap = window.setInterval(() => {
    if (typeof map === 'undefined' || !map) return;
    window.clearInterval(waitForMap);
    map.on('dragstart zoomstart', recordUserInteraction);
    observeMapContainer();
    runStabilizationSequence({ forceRefit: true });
  }, 40);

  window.setTimeout(() => window.clearInterval(waitForMap), 5000);
})();
