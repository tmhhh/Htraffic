const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Intercept API requests
    const cameras = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('AjaxPro') || url.includes('.ashx') || response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
            try {
                const text = await response.text();
                // If it looks like JSON or contains camera data
                if (text.includes('camId') || text.includes('cameraId') || text.includes('Camera') || text.includes('camera')) {
                    console.log(`Found potential camera data in response from: ${url}`);
                    fs.writeFileSync(`response_${Date.now()}.txt`, text);
                }
            } catch (e) {
                // Ignore if response body cannot be read
            }
        }
    });

    console.log('Navigating to Map.aspx...');
    await page.goto('https://giaothong.hochiminhcity.gov.vn/Map.aspx', { waitUntil: 'networkidle' });
    
    // Wait an extra few seconds for cameras to load on map
    console.log('Waiting for cameras to load...');
    await page.waitForTimeout(10000); // wait 10s
    
    // Try to extract from window variables
    console.log('Extracting from global variables...');
    const extractedData = await page.evaluate(() => {
        let result = [];
        // Check if ExtJS stores exist
        if (typeof Ext !== 'undefined' && Ext.StoreManager) {
            Ext.StoreManager.each(function(store) {
                if (store.storeId && store.storeId.toLowerCase().includes('camera')) {
                    store.each(function(record) {
                        result.push(record.data);
                    });
                }
            });
        }
        return result;
    });
    
    if (extractedData && extractedData.length > 0) {
        console.log(`Extracted ${extractedData.length} cameras from ExtJS stores!`);
        fs.writeFileSync('cameras.json', JSON.stringify(extractedData, null, 2));
    } else {
        console.log('No cameras found in ExtJS stores, check the response_*.txt files for intercepted API data.');
    }
    
    await browser.close();
    console.log('Done.');
})();
