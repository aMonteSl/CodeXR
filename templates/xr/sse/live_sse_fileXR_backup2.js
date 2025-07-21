
    console.log('🔄 Setting up EventSource for unified live reload...');

    const eventSource = new EventSource('/live-reload');
    let isXRMode = false;

    // Check if we're in an A-Frame scene
    function checkXRMode() {
      isXRMode = !!document.querySelector('a-scene');
      console.log(isXRMode ? '🥽 XR mode detected' : '🖥️ Standard mode detected');
      return isXRMode;
    }

    document.addEventListener('DOMContentLoaded', checkXRMode);

    eventSource.onopen = function() {
      console.log('🟢 EventSource connection established');
    };

    eventSource.onerror = function(err) {
      console.error('🔴 EventSource error:', err);
      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        eventSource.close();
        new EventSource('/live-reload');
      }, 3000);
    };

    
    // Handle analysisUpdated events
    eventSource.addEventListener('analysisUpdated', function(event) {
      console.log('🔄 Received analysisUpdated event:', event);
      
      // Find data entities using all provided selectors
      let dataEntities = [];
      
      dataEntities = [...dataEntities, ...document.querySelectorAll('#data')];
      dataEntities = [...dataEntities, ...document.querySelectorAll('[babia-queryjson]')];
      
      // Find chart entities using all provided selectors
      let chartEntities = [];
      
      chartEntities = [...chartEntities, ...document.querySelectorAll('#chart')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-bars]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-cylinders]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-pie]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-donut]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-barsmap]')];
      
      if (dataEntities.length > 0) {
        const timestamp = Date.now();
        console.log('🔄 Refreshing ' + dataEntities.length + ' data entities');
        
        // Update each data entity
        dataEntities.forEach(dataEntity => {
          // Get current attributes
          const queryjson = dataEntity.getAttribute('babia-queryjson');
          if (queryjson) {
            // Add cache busting parameter
            const urlStr = typeof queryjson === 'string' ? queryjson : queryjson.url || '';
            let url = '';
            
            if (typeof urlStr === 'string') {
              url = urlStr.split('?')[0] + '?t=' + timestamp;
            }
            
            // Handle both string and object attributes
            if (typeof queryjson === 'string') {
              dataEntity.setAttribute('babia-queryjson', url);
            } else {
              const newAttr = { ...queryjson };
              newAttr.url = url;
              dataEntity.setAttribute('babia-queryjson', newAttr);
            }
            
            // Trigger data refresh event after a short delay
            setTimeout(() => {
              dataEntity.emit('data-loaded', {});
              console.log('📊 Data entity refreshed');
            }, 100);
          }
        });

        // Rebuild charts after data is loaded
        setTimeout(() => {
          chartEntities.forEach(chartEntity => {
            // Find which component type is used
            for (const type of ["babia-boats","babia-bars","babia-cylinders","babia-pie","babia-donut","babia-barsmap"]) {
              if (chartEntity.hasAttribute(type)) {
                const attributes = chartEntity.getAttribute(type);
                console.log('🔄 Rebuilding ' + type + ' chart');
                
                // Remove and re-add component to force refresh
                chartEntity.removeAttribute(type);
                setTimeout(() => {
                  chartEntity.setAttribute(type, attributes);
                  console.log('✅ Chart rebuilt successfully');
                }, 50);
                break;
              }
            }
          });
        }, 200);
      } else {
        console.warn('⚠️ No data entities found for refresh');
      }
    });
  

    // Handle dataRefresh events
    eventSource.addEventListener('dataRefresh', function(event) {
      console.log('🔄 Received dataRefresh event:', event);
      
      // Find data entities using all provided selectors
      let dataEntities = [];
      
      dataEntities = [...dataEntities, ...document.querySelectorAll('#data')];
      dataEntities = [...dataEntities, ...document.querySelectorAll('[babia-queryjson]')];
      
      // Find chart entities using all provided selectors
      let chartEntities = [];
      
      chartEntities = [...chartEntities, ...document.querySelectorAll('#chart')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-bars]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-cylinders]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-pie]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-donut]')];
      chartEntities = [...chartEntities, ...document.querySelectorAll('[babia-barsmap]')];
      
      if (dataEntities.length > 0) {
        const timestamp = Date.now();
        console.log('🔄 Refreshing ' + dataEntities.length + ' data entities');
        
        // Update each data entity
        dataEntities.forEach(dataEntity => {
          // Get current attributes
          const queryjson = dataEntity.getAttribute('babia-queryjson');
          if (queryjson) {
            // Add cache busting parameter
            const urlStr = typeof queryjson === 'string' ? queryjson : queryjson.url || '';
            let url = '';
            
            if (typeof urlStr === 'string') {
              url = urlStr.split('?')[0] + '?t=' + timestamp;
            }
            
            // Handle both string and object attributes
            if (typeof queryjson === 'string') {
              dataEntity.setAttribute('babia-queryjson', url);
            } else {
              const newAttr = { ...queryjson };
              newAttr.url = url;
              dataEntity.setAttribute('babia-queryjson', newAttr);
            }
            
            // Trigger data refresh event after a short delay
            setTimeout(() => {
              dataEntity.emit('data-loaded', {});
              console.log('📊 Data entity refreshed');
            }, 100);
          }
        });

        // Rebuild charts after data is loaded
        setTimeout(() => {
          chartEntities.forEach(chartEntity => {
            // Find which component type is used
            for (const type of ["babia-boats","babia-bars","babia-cylinders","babia-pie","babia-donut","babia-barsmap"]) {
              if (chartEntity.hasAttribute(type)) {
                const attributes = chartEntity.getAttribute(type);
                console.log('🔄 Rebuilding ' + type + ' chart');
                
                // Remove and re-add component to force refresh
                chartEntity.removeAttribute(type);
                setTimeout(() => {
                  chartEntity.setAttribute(type, attributes);
                  console.log('✅ Chart rebuilt successfully');
                }, 50);
                break;
              }
            }
          });
        }, 200);
      } else {
        console.warn('⚠️ No data entities found for refresh');
      }
    });
  

    // Handle general reload messages
    eventSource.onmessage = function(event) {
      console.log('Generic message received:', event.data);
      
      // Skip reload if in XR mode
      if (checkXRMode()) {
        console.log('⛔ Blocking page reload in XR mode');
        return false;
      }
      
      if (event.data === 'reload') {
        console.log('💫 Live reload triggered, refreshing page...');
        window.location.reload();
      }
    };
