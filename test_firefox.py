from playwright.sync_api import sync_playwright

print('Testing Firefox...')
try:
    with sync_playwright() as p:
        browser = p.firefox.launch()
        browser.close()
        print('Firefox works!')
except Exception as e:
    print(f'Firefox error: {e}')