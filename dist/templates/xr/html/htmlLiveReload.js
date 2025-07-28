/**
 * HTML Live Reload Client
 * Manages live updates for HTML DOM visualization in both standard and XR modes
 */

console.log('🌐 Setting up EventSource for HTML live reload...');

const eventSource = new EventSource('/events');
let isXRMode = false;

function checkXRMode() {
  isXRMode = !!document.querySelector('a-scene');
  console.log(isXRMode ? '🥽 XR mode detected' : '🖥️ Standard mode detected');
  return isXRMode;
}

document.addEventListener('DOMContentLoaded', checkXRMode);

eventSource.onopen = function () {
  console.log('🟢 HTML EventSource connection established');
  console.log('🌐 DOM Visualization live reload ready - file changes will update automatically');
};

eventSource.onerror = function (err) {
  console.error('🔴 HTML EventSource error:', err);
  setTimeout(() => {
    console.log('🔄 Attempting to reconnect HTML EventSource...');
    eventSource.close();
    // Try to reconnect to /events (not /live-reload)
    location.reload();
  }, 3000);
};

eventSource.addEventListener('message', function(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('🔄 SSE received:', data);
        
        // Handle different types of updates
        if (data.type === 'htmlUpdated' && data.action === 'reload-html') {
            console.log('🌐 HTML content updated, updating babia-html component...');
            
            // Get the htmlDOM entity (same as the buttons do)
            let entity = document.querySelector('#htmlDOM');
            if (!entity) {
                console.warn('⚠️ #htmlDOM entity not found, falling back to page reload');
                location.reload();
                return;
            }
            
            // Try to get htmlContent from the data
            let newHtmlContent = '';
            if (data.htmlContent) {
                // Direct htmlContent in the SSE message
                newHtmlContent = data.htmlContent;
                console.log('📄 Got HTML content directly from SSE message');
            } else {
                console.log('📡 Fetching updated data.json...');
                // Fetch the updated data.json to get htmlContent
                fetch('/data.json')
                    .then(response => response.json())
                    .then(jsonData => {
                        if (jsonData.htmlContent) {
                            newHtmlContent = jsonData.htmlContent;
                            updateBabiaHtmlComponent(entity, newHtmlContent);
                        } else {
                            console.warn('⚠️ No htmlContent found in data.json');
                        }
                    })
                    .catch(error => {
                        console.error('❌ Error fetching data.json:', error);
                    });
                return; // Exit here since we're handling async
            }
            
            updateBabiaHtmlComponent(entity, newHtmlContent);
            
        } else if (data.type === 'analysis-updated' && data.action === 'reload-data') {
            console.log('📊 Analysis data updated, refreshing...');
            location.reload();
        }
    } catch (error) {
        console.error('❌ Error parsing SSE message:', error);
    }
});

// Function to update the babia-html component (like the buttons do)
function updateBabiaHtmlComponent(entity, htmlContent) {
    try {
        console.log('🔧 Updating babia-html component with new content...');
        
        // Update the babia-html attribute with new HTML content (same pattern as buttons)
        entity.setAttribute('babia-html', {
            renderHTML: true,
            renderHTMLOnlyLeafs: true,
            distanceLevels: 0.7,
            html: htmlContent
        });
        
        console.log('✅ babia-html component updated successfully');
        
        // Show a brief visual feedback
        const originalColor = entity.getAttribute('material') || {};
        entity.setAttribute('material', 'color: #00ff00; opacity: 0.3');
        setTimeout(() => {
            entity.removeAttribute('material');
        }, 200);
        
    } catch (error) {
        console.error('❌ Failed to update babia-html component:', error);
        console.log('🔄 Falling back to page reload...');
        location.reload();
    }
}
