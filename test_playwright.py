from playwright.sync_api import sync_playwright

print('Testing browser...')
with sync_playwright() as p:
    browser = p.chromium.launch()
    browser.close()
    print('Chromium works!')