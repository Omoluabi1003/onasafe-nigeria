(() => {
  const MAP_REFIT_PADDING = [54, 54];
  let scheduledFrame = 0;
  let resizeObserver = null;

  function stabilizeMap({ refit = false } = {}) {
    if (typeof map === 'undefined' || !map) return;

    if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      map.invalidateSize({ animate: false, pan: false });

      if (refit && typeof corridorLayer !== 'undefined' && corridorLayer) {
        const bounds = corridorLayer.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: MAP_REFIT_PADDING, animate: false });
        }
      }
    });
  }

  function runStabilizationSequence() {
    stabilizeMap({ refit: true });
    window.setTimeout(() => stabilizeMap({ refit: true }), 120);
    window.setTimeout(() => stabilizeMap({ refit: true }), 420);
    window.setTimeout(() => stabilizeMap({ refit: false }), 900);
  }

  function observeMapContainer() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver(() => stabilizeMap({ refit: false }));
    resizeObserver.observe(mapElement);
  }

  window.addEventListener('load', runStabilizationSequence, { once: true });
  window.addEventListener('pageshow', runStabilizationSequence);
  window.addEventListener('resize', () => stabilizeMap({ refit: false }), { passive: true });
  window.addEventListener('orientationchange', () => {
    stabilizationTimeouts.push(window.setTimeout(() => stabilizeMap({ refit: true }), 250));
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

  observeMapContainer();
  runStabilizationSequence();
})();
