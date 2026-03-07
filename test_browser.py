#!/usr/bin/env python3
"""
Test script for headless browser functionality using Playwright
"""

from playwright.sync_api import sync_playwright
import sys

def test_bilibili():
    """Test accessing Bilibili homepage with headless browser"""
    try:
        with sync_playwright() as p:
            # Launch browser in headless mode
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to Bilibili
            page.goto("https://www.bilibili.com")
            
            # Wait for page to load
            page.wait_for_load_state("networkidle")
            
            # Get page title and content
            title = page.title()
            content = page.text_content("body")
            
            # Extract main navigation items
            nav_items = page.query_selector_all("nav a, .nav-link, .menu-item")
            nav_texts = []
            for item in nav_items[:20]:  # Limit to first 20 items
                text = item.text_content().strip()
                if text:
                    nav_texts.append(text)
            
            browser.close()
            
            print(f"Page Title: {title}")
            print(f"Navigation Items: {nav_texts[:10]}")  # Show first 10 items
            
            return {
                "title": title,
                "navigation": nav_texts[:15],
                "success": True
            }
            
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = test_bilibili()
    if result["success"]:
        print("✅ Headless browser test successful!")
    else:
        print("❌ Headless browser test failed!")
        sys.exit(1)