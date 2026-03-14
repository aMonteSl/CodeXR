/**
 * HTML Live Reload Client
 * Manages live updates for HTML DOM visualization in both standard and XR modes
 */

console.log('Setting up EventSource for HTML live reload...');

const eventSource = new EventSource('/events');
let isXRMode = false;

function checkXRMode() {
  isXRMode = !!document.querySelector('a-scene');
  console.log(isXRMode ? 'XR mode detected' : 'Standard mode detected');
  return isXRMode;
}

function getCurrentDistanceLevel(entity) {
  const currentConfig = entity.getAttribute('babia-html');
  return currentConfig && typeof currentConfig.distanceLevels === 'number'
    ? currentConfig.distanceLevels
    : 0.7;
}

function applyBabiaHtmlComponent(entity, htmlContent, distanceLevels) {
  window.__CODEXR_DOM_HTML_PAYLOAD__ = htmlContent;
  entity.removeAttribute('babia-html');
  requestAnimationFrame(() => {
    entity.setAttribute('babia-html', {
      renderHTML: true,
      renderHTMLOnlyLeafs: true,
      html: htmlContent,
      distanceLevels,
    });
  });
}

document.addEventListener('DOMContentLoaded', checkXRMode);

eventSource.onopen = function () {
  console.log('HTML EventSource connection established');
  console.log('DOM Visualization live reload ready - file changes will update automatically');
};

eventSource.onerror = function (err) {
  console.error('HTML EventSource error:', err);
  setTimeout(() => {
    console.log('Attempting to reconnect HTML EventSource...');
    eventSource.close();
    location.reload();
  }, 3000);
};

eventSource.addEventListener('message', function(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('SSE received:', data);
        
        if (data.type === 'htmlUpdated' && data.action === 'reload-html') {
            console.log('HTML content updated, updating babia-html component...');
            
            let entity = document.querySelector('#htmlDOM');
            if (!entity) {
                console.warn('#htmlDOM entity not found, falling back to page reload');
                location.reload();
                return;
            }

            if (!data.htmlContent) {
                console.warn('No htmlContent received in DOM SSE message; reloading page');
                location.reload();
                return;
            }
            
            updateBabiaHtmlComponent(entity, data.htmlContent);
            
        } else if (data.type === 'analysis-updated' && data.action === 'reload-data') {
            console.log('Analysis data updated, refreshing...');
            location.reload();
        }
    } catch (error) {
        console.error('Error parsing SSE message:', error);
    }
});

function updateBabiaHtmlComponent(entity, htmlContent) {
    try {
        console.log('Updating babia-html component with new content...');
        const distanceLevels = getCurrentDistanceLevel(entity);
        applyBabiaHtmlComponent(entity, htmlContent, distanceLevels);
        console.log('babia-html component updated successfully');
    } catch (error) {
        console.error('Failed to update babia-html component:', error);
        console.log('Falling back to page reload...');
        location.reload();
    }
}
