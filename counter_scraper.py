#!/usr/bin/env python3
"""
Counter.dev analytics scraper
Usage: python3 counter_scraper.py
"""
from playwright.sync_api import sync_playwright
import json
import sys

EMAIL = "yupenbob@163.com"
PASSWORD = "bob100125"
LOGIN_URL = "https://counter.dev/login"
DASHBOARD_URL = "https://counter.dev/dashboard"

def scrape():
    with sync_playwright() as p:
        # Launch headless browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        )
        page = context.new_page()
        
        print("🔐 Logging in to counter.dev...")
        page.goto(LOGIN_URL, wait_until="networkidle")
        
        # Fill login form
        page.fill('input[name="email"]', EMAIL)
        page.fill('input[name="password"]', PASSWORD)
        page.click('button[type="submit"]')
        
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        
        print(f"Current URL: {page.url}")
        
        # Go to dashboard
        page.goto(DASHBOARD_URL, wait_until="networkidle")
        page.wait_for_timeout(3000)
        
        print(f"Dashboard URL: {page.url}")
        
        # Extract text content
        content = page.inner_text("body")
        print("\n=== Dashboard Content ===")
        print(content[:3000])
        
        # Try to get page structure
        try:
            stats = page.query_selector_all("[class*='stat'], [class*='count'], [class*='number'], h1, h2, h3")
            print("\n=== Stats elements ===")
            for s in stats[:20]:
                txt = s.inner_text().strip()
                if txt:
                    print(f"  {txt}")
        except Exception as e:
            print(f"Stats extraction error: {e}")
        
        # Take screenshot for reference
        page.screenshot(path="/tmp/counter_dashboard.png", full_page=True)
        print("\n📸 Screenshot saved to /tmp/counter_dashboard.png")
        
        browser.close()

if __name__ == "__main__":
    scrape()
