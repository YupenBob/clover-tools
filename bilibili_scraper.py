#!/usr/bin/env python3
"""
Bilibili homepage scraper using Playwright (headless browser)
"""

import asyncio
from playwright.async_api import async_playwright
import json
import time

async def scrape_bilibili_homepage():
    """Scrape Bilibili homepage content"""
    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # Navigate to Bilibili homepage
            print("正在访问Bilibili主页...")
            await page.goto("https://www.bilibili.com", timeout=30000)
            
            # Wait for page to load
            await page.wait_for_load_state("networkidle")
            
            # Get page title
            title = await page.title()
            print(f"页面标题: {title}")
            
            # Extract main navigation categories
            categories = await page.eval_on_selector_all(
                "nav a, .nav-link, .category-item",
                "elements => elements.map(el => el.textContent.trim()).filter(text => text.length > 0)"
            )
            
            # Remove duplicates and empty strings
            unique_categories = list(set([cat for cat in categories if cat]))
            
            print("\nBilibili主页主要分区:")
            for i, category in enumerate(unique_categories[:20], 1):
                print(f"{i}. {category}")
            
            # Take a screenshot for verification
            await page.screenshot(path="bilibili_homepage.png")
            print("\n已保存主页截图: bilibili_homepage.png")
            
            # Save data to JSON
            data = {
                "timestamp": time.time(),
                "title": title,
                "categories": unique_categories,
                "url": "https://www.bilibili.com"
            }
            
            with open("bilibili_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print("数据已保存到 bilibili_data.json")
            
        except Exception as e:
            print(f"抓取过程中出现错误: {e}")
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_bilibili_homepage())