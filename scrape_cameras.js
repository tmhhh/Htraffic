const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('Navigating to Map.aspx...');
    await page.goto('https://giaothong.hochiminhcity.gov.vn/Map.aspx', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting 20s for the page to initialize completely...');
    await page.waitForTimeout(20000);

    console.log('Trying to extract data from window variables...');
    try {
        const windowData = await page.evaluate(() => {
            let data = [];
            // Try to find Leaflet or OpenLayers markers
            const mapKeys = Object.keys(window).filter(k => k.toLowerCase().includes('map'));
            
            // Just scan all script tags and text for JSON that looks like camera data
            const html = document.documentElement.innerHTML;
            
            // A more aggressive ExtJS extraction
            if (typeof Ext !== 'undefined' && Ext.StoreManager) {
                Ext.StoreManager.each(function(store) {
                    store.each(function(record) {
                        if (record.data && (record.data.camId || record.data.Title || record.data.VideoUrl || record.data.Id)) {
                            let cleanData = {};
                            for (let key in record.data) {
                                if (typeof record.data[key] === 'string' || typeof record.data[key] === 'number' || typeof record.data[key] === 'boolean') {
                                    cleanData[key] = record.data[key];
                                }
                            }
                            data.push(cleanData);
                        }
                    });
                });
            }
            return {
                cameras: data,
                mapKeys: mapKeys,
            };
        });
        
        console.log(`Found ${windowData.cameras.length} objects`);
        if (windowData.cameras.length > 0) {
            fs.writeFileSync('/Users/tmhhh/Code/FreeLance/HTraffic/all_cameras.json', JSON.stringify(windowData.cameras, null, 2), 'utf8');
            console.log('Successfully wrote to all_cameras.json');
        } else {
            console.log('No cameras found.');
        }
    } catch (e) {
        console.log('Error extracting:', e.message);
    }
    
    await browser.close();
    console.log('Done.');
})();
