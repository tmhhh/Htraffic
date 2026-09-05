const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Launching visible browser...');
    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('Navigating to Map.aspx...');
    await page.goto('https://giaothong.hochiminhcity.gov.vn/Map.aspx', { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting 10s for the map to fully load...');
    await page.waitForTimeout(10000);

    console.log('Clicking the Camera checkbox on the left...');
    try {
        await page.evaluate(() => {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                if (span.innerText.trim() === 'Camera') {
                    let tr = span.closest('tr');
                    if (tr) {
                        let input = tr.querySelector('input');
                        if (input) input.click();
                    }
                }
            }
        });
    } catch (e) {
        console.log('Could not click checkbox automatically.');
    }

    console.log('Waiting 10s for all camera markers across HCMC to load into the map...');
    await page.waitForTimeout(10000);

    // 1. Visually simulate clicking the first few markers to demonstrate the popup and full-screen tab
    console.log('\n--- Demonstrating interactive marker click & full-screen popup ---');
    const markerLocators = await page.locator('img[src*="camera_angle_green.png"]').all();
    const viewportSize = page.viewportSize() || { width: 1280, height: 720 };
    
    for (let i = 0; i < Math.min(2, markerLocators.length); i++) {
        const marker = markerLocators[i];
        const box = await marker.boundingBox();
        if (box && box.x > 460 && box.y > 140 && (box.y + box.height) < (viewportSize.height - 140)) {
            console.log(`Clicking visible marker #${i + 1}...`);
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            try {
                const expandBtn = page.locator('[id*="btnExpand"]:visible, [data-qtip*="Mở rộng"]:visible').last();
                await expandBtn.waitFor({ state: 'visible', timeout: 6000 });
                const [demoPage] = await Promise.all([
                    context.waitForEvent('page', { timeout: 8000 }),
                    expandBtn.click()
                ]);
                await demoPage.waitForLoadState('domcontentloaded');
                console.log(`Demo: Successfully launched full view camera tab: ${demoPage.url()}`);
                await demoPage.close();
            } catch (err) {
                console.log('Demo click note:', err.message);
            }
            break;
        }
    }

    // 2. Extract ALL cameras loaded in the map (all 700+ cameras across entire city)
    console.log('\nExtracting all camera markers loaded in the map...');
    const allExtractedCameras = await page.evaluate(() => {
        const mapPanels = Ext.ComponentQuery.query('mappanel, [xtype*="map"]');
        if (mapPanels.length === 0) return [];
        const map = mapPanels[0].map;
        const allMarkers = map.getAllMarker ? map.getAllMarker() : {};
        const results = [];
        const seenIds = new Set();
        for (let k in allMarkers) {
            const m = allMarkers[k];
            if (m.data && (m.data.CamId || m.data.Id)) {
                const id = m.data.CamId || m.data.Id;
                const name = m.data.DisplayName || m.data.Title || '';
                const videoUrl = (m.data.VideoUrl && !m.data.VideoUrl.includes('bipbop')) ? m.data.VideoUrl : null;

                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    let fullUrl = 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=' + id + 
                                  '&camLocation=' + encodeURIComponent(name) + 
                                  '&camMode=camera';
                    if (videoUrl) {
                        fullUrl += '&videoUrl=' + encodeURIComponent(videoUrl);
                    }
                    results.push({
                        id: id,
                        name: name,
                        url: fullUrl,
                        videoUrl: videoUrl
                    });
                }
            }
        }
        return results;
    });

    console.log(`Found a total of ${allExtractedCameras.length} unique cameras on the map!`);

    // 3. Load existing cameras.json and merge without duplicates
    let existingCameras = [];
    if (fs.existsSync('cameras.json')) {
        try {
            const raw = fs.readFileSync('cameras.json', 'utf8').trim();
            if (raw) existingCameras = JSON.parse(raw);
        } catch (e) {
            existingCameras = [];
        }
    }

    const seenIds = new Set(existingCameras.map(c => c.id).filter(Boolean));
    const seenUrls = new Set(existingCameras.map(c => c.url).filter(Boolean));

    let addedCount = 0;
    for (const cam of allExtractedCameras) {
        if (!seenIds.has(cam.id) && !seenUrls.has(cam.url)) {
            seenIds.add(cam.id);
            seenUrls.add(cam.url);
            existingCameras.push(cam);
            addedCount++;
        }
    }

    // Write all unique cameras to cameras.json
    fs.writeFileSync('cameras.json', JSON.stringify(existingCameras, null, 2), 'utf8');

    console.log(`\n========================================`);
    console.log(`Added ${addedCount} new unique cameras.`);
    console.log(`Total cameras now in cameras.json: ${existingCameras.length}`);
    console.log(`========================================`);

    console.log('\nLeaving browser open for 5 seconds...');
    await page.waitForTimeout(5000);

    await browser.close();
    console.log('Browser closed. Done.');
})();
