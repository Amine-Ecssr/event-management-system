#!/usr/bin/env python3
"""
ADNEC Events Data Fetcher (with Selenium for dynamic content)

This script fetches event data from the ADNEC Centre Abu Dhabi website using Selenium
to handle dynamically loaded content.

Features:
- Handle JavaScript-rendered content
- Scroll to load all events
- Fetch events from both EN and AR listings
- Extract structured event data using JSON-LD schema
- Parse date ranges and format hall locations
- Save data in multiple formats (JSON, CSV)

Requirements:
    pip install selenium webdriver-manager
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import re
from datetime import datetime
from urllib.parse import urljoin
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
import time
import argparse

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException
    from webdriver_manager.chrome import ChromeDriverManager
    from selenium.webdriver.chrome.service import Service
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    print("⚠️  Selenium not available. Install with: pip install selenium webdriver-manager")

@dataclass
class AdnecEvent:
    """Data class to represent an ADNEC event."""
    title: str
    title_ar: str
    url: str
    url_ar: str
    start_date: str
    end_date: str
    location: str
    organizer: str
    description: str
    image_url: str = ""
    organizer_url: str = ""

class AdnecEventsFetcher:
    """Fetcher class for ADNEC Centre Abu Dhabi events with Selenium support."""
    
    def __init__(self, use_selenium: bool = True):
        self.base_url_en = "https://www.adnec.ae/en/eventlisting"
        self.base_url_ar = "https://www.adnec.ae/ar/eventlisting"
        self.use_selenium = use_selenium and SELENIUM_AVAILABLE
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })
    
    def create_driver(self):
        """Create a Selenium WebDriver instance."""
        if not SELENIUM_AVAILABLE:
            return None
        
        options = Options()
        options.add_argument('--headless')  # Run in background
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    
    def fetch_page_with_selenium(self, url: str) -> Optional[str]:
        """Fetch a page using Selenium to handle dynamic content."""
        driver = self.create_driver()
        if not driver:
            return None
        
        try:
            print(f"  🌐 Loading page with Selenium: {url}")
            driver.get(url)
            
            # Wait for the grid to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.grid"))
            )
            
            # Scroll down to trigger lazy loading
            last_height = driver.execute_script("return document.body.scrollHeight")
            events_count = 0
            
            for scroll_attempt in range(10):  # Try up to 10 scrolls
                # Scroll to bottom
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)  # Wait for content to load
                
                # Check if we have more events
                event_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/eventlisting/']")
                new_count = len([link for link in event_links if '/eventlisting/' in link.get_attribute('href') and link.get_attribute('href') not in [url]])
                
                print(f"    Scroll {scroll_attempt + 1}: Found {new_count} events")
                
                if new_count == events_count:
                    # No new events loaded
                    break
                
                events_count = new_count
                
                # Calculate new scroll height
                new_height = driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
            
            html_content = driver.page_source
            return html_content
            
        except Exception as e:
            print(f"  ❌ Error with Selenium: {e}")
            return None
        finally:
            driver.quit()
    
    def fetch_page(self, url: str, retries: int = 3) -> Optional[str]:
        """Fetch a webpage (detail pages use requests, listing pages use Selenium)."""
        # For listing pages, use Selenium if available
        if '/eventlisting' in url and url.endswith('eventlisting'):
            if self.use_selenium:
                return self.fetch_page_with_selenium(url)
        
        # For detail pages, use regular requests
        for attempt in range(retries):
            try:
                print(f"  📡 Fetching: {url}")
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return response.text
            except requests.RequestException as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    print(f"  ❌ Failed to fetch {url}")
                    return None
    
    def extract_event_urls_from_listing(self, html_content: str, base_url: str) -> List[str]:
        """Extract event URLs from the listing page."""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find all event links
        event_links = soup.find_all('a', href=lambda x: x and '/eventlisting/' in str(x))
        
        event_urls = []
        seen_urls = set()
        
        for link in event_links:
            href = link.get('href', '')
            # Skip if it's just the listing page itself
            if href and href not in ['/en/eventlisting', '/ar/eventlisting']:
                full_url = urljoin(base_url, href)
                # Deduplicate
                if full_url not in seen_urls:
                    seen_urls.add(full_url)
                    event_urls.append(full_url)
        
        return event_urls
    
    def parse_iso_datetime_to_readable(self, iso_datetime: str) -> str:
        """Convert ISO datetime to readable format."""
        try:
            dt = datetime.fromisoformat(iso_datetime)
            return dt.strftime("%d %B %Y")
        except:
            return iso_datetime
    
    def format_location(self, location: str) -> str:
        """Format location to include ADNEC context."""
        location = location.strip()
        
        if re.match(r'^Hall[s]?\s+[\d\-,\s]+$', location, re.IGNORECASE):
            return f"ADNEC ({location})"
        
        if 'hall' in location.lower() and 'ADNEC' not in location:
            return f"ADNEC ({location})"
        
        return location
    
    def extract_event_details(self, url: str) -> Optional[Dict]:
        """Extract detailed event information from the event detail page."""
        html_content = self.fetch_page(url)
        if not html_content:
            return None
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract JSON-LD structured data
        event_data = None
        scripts = soup.find_all('script', type='application/ld+json')
        
        for script in scripts:
            if script.string and '@type' in script.string:
                try:
                    data = json.loads(script.string)
                    if data.get('@type') == 'Event':
                        event_data = data
                        break
                except json.JSONDecodeError:
                    continue
        
        if not event_data:
            return None
        
        # Extract hall/location
        hall_location = "ADNEC Centre Abu Dhabi"
        location_label = soup.find(string=lambda x: x and ('location:' in str(x).lower() or 'الموقع' in str(x)))
        
        if location_label:
            parent = location_label.find_parent()
            if parent:
                container = parent.find_parent(['div', 'section'])
                if container:
                    text = container.get_text()
                    lines = [line.strip() for line in text.split('\n') if line.strip()]
                    for i, line in enumerate(lines):
                        if 'Location:' in line or 'الموقع' in line:
                            if i + 1 < len(lines) and ':' not in lines[i + 1]:
                                hall_location = self.format_location(lines[i + 1])
                                break
        
        # Parse dates
        start_date = self.parse_iso_datetime_to_readable(event_data.get('startDate', ''))
        end_date = self.parse_iso_datetime_to_readable(event_data.get('endDate', ''))
        
        # Extract organizer
        organizer_name = ""
        organizer_url = ""
        if 'organizer' in event_data:
            org = event_data['organizer']
            organizer_name = org.get('name', '')
            organizer_url = org.get('url', '')
        
        # Extract image
        image_url = ""
        if 'image' in event_data:
            images = event_data['image']
            if isinstance(images, list) and images:
                image_url = images[0]
            elif isinstance(images, str):
                image_url = images
        
        return {
            'title': event_data.get('name', ''),
            'url': url,
            'start_date': start_date,
            'end_date': end_date,
            'location': hall_location,
            'organizer': organizer_name,
            'organizer_url': organizer_url,
            'description': event_data.get('description', ''),
            'image_url': image_url
        }
    
    def fetch_all_events(self, include_arabic: bool = True) -> List[AdnecEvent]:
        """Fetch all events from ADNEC website."""
        print("🏛️  ADNEC Events Data Fetcher (with Selenium)")
        print("=" * 50)
        
        if not self.use_selenium:
            print("⚠️  Selenium not available - may only get first few events")
        
        # Fetch English listing
        print("\n📅 Fetching English event listings...")
        en_html = self.fetch_page(self.base_url_en)
        if not en_html:
            print("❌ Failed to fetch English listings")
            return []
        
        en_urls = self.extract_event_urls_from_listing(en_html, self.base_url_en)
        print(f"  ✅ Found {len(en_urls)} events in English listing")
        
        # Fetch Arabic listing
        url_mapping = {}
        if include_arabic:
            print("\n📅 Fetching Arabic event listings...")
            ar_html = self.fetch_page(self.base_url_ar)
            if ar_html:
                ar_urls = self.extract_event_urls_from_listing(ar_html, self.base_url_ar)
                print(f"  ✅ Found {len(ar_urls)} events in Arabic listing")
                
                for ar_url in ar_urls:
                    slug = ar_url.split('/eventlisting/')[-1]
                    en_equivalent = f"https://www.adnec.ae/en/eventlisting/{slug}"
                    url_mapping[en_equivalent] = ar_url
        
        # Fetch details
        events = []
        print(f"\n📋 Fetching details for {len(en_urls)} events...")
        
        for i, en_url in enumerate(en_urls, 1):
            print(f"\n[{i}/{len(en_urls)}] Processing: {en_url.split('/')[-1]}")
            
            en_details = self.extract_event_details(en_url)
            if not en_details:
                continue
            
            # Fetch Arabic version
            title_ar = ""
            ar_url = url_mapping.get(en_url, '')
            if ar_url:
                ar_details = self.extract_event_details(ar_url)
                if ar_details:
                    title_ar = ar_details.get('title', '')
            
            event = AdnecEvent(
                title=en_details['title'],
                title_ar=title_ar,
                url=en_url,
                url_ar=ar_url,
                start_date=en_details['start_date'],
                end_date=en_details['end_date'],
                location=en_details['location'],
                organizer=en_details['organizer'],
                description=en_details['description'],
                image_url=en_details['image_url'],
                organizer_url=en_details['organizer_url']
            )
            events.append(event)
            
            time.sleep(1)
        
        return events
    
    def save_events_json(self, events: List[AdnecEvent], filename: str):
        """Save events to JSON file."""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump([asdict(e) for e in events], f, indent=2, ensure_ascii=False)
        print(f"💾 Saved {len(events)} events to {filename}")
    
    def save_events_csv(self, events: List[AdnecEvent], filename: str):
        """Save events to CSV file."""
        if not events:
            return
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(asdict(events[0]).keys()))
            writer.writeheader()
            for event in events:
                writer.writerow(asdict(event))
        print(f"💾 Saved {len(events)} events to {filename}")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Fetch ADNEC events data')
    parser.add_argument('--no-arabic', action='store_true', help='Skip Arabic translations')
    parser.add_argument('--no-selenium', action='store_true', help='Disable Selenium (may get fewer events)')
    parser.add_argument('--output', default='adnec_events', help='Output filename prefix')
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='both', help='Output format')
    
    args = parser.parse_args()
    
    fetcher = AdnecEventsFetcher(use_selenium=not args.no_selenium)
    
    # Fetch all events
    events = fetcher.fetch_all_events(include_arabic=not args.no_arabic)
    
    print(f"\n🎉 Total events found: {len(events)}")
    
    if events:
        print("\n📋 Events found:")
        for i, event in enumerate(events, 1):
            print(f"\n  {i}. {event.title}")
            if event.title_ar:
                print(f"     {event.title_ar}")
            print(f"     📅 {event.start_date} - {event.end_date}")
            print(f"     📍 {event.location}")
            if event.organizer:
                print(f"     🏢 {event.organizer}")
        
        # Save
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if args.format in ['json', 'both']:
            fetcher.save_events_json(events, f"{args.output}_{timestamp}.json")
        if args.format in ['csv', 'both']:
            fetcher.save_events_csv(events, f"{args.output}_{timestamp}.csv")
    else:
        print("❌ No events found")
    
    print("\n✨ Done!")

if __name__ == "__main__":
    main()
