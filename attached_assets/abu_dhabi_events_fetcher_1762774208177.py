#!/usr/bin/env python3
"""
Abu Dhabi Events Data Fetcher

This script fetches event data from the Abu Dhabi Media Office events website.
It can retrieve events for specific months and extract structured information
about each event.

Features:
- Fetch events for specific months/years
- Extract event details (title, date, location, description, etc.)
- Save data in multiple formats (JSON, CSV)
- Handle pagination and multiple months
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import re
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse, parse_qs
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
import time
import argparse
import sys

@dataclass
class Event:
    """Data class to represent an event."""
    title: str
    url: str
    start_date: str
    end_date: str = ""
    location: str = ""
    organizer: str = ""
    sector: str = ""
    description: str = ""
    view_event_url: str = ""

class AbuDhabiEventsFetcher:
    """Fetcher class for Abu Dhabi Media Office events."""
    
    def __init__(self):
        self.base_url = "https://www.mediaoffice.abudhabi/en/abu-dhabi-events/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        })
    
    def fetch_page(self, url: str, retries: int = 3) -> Optional[str]:
        """Fetch a webpage with retries."""
        for attempt in range(retries):
            try:
                print(f"  📡 Fetching: {url}")
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                return response.text
            except requests.RequestException as e:
                print(f"  ⚠️  Attempt {attempt + 1} failed: {e}")
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    print(f"  ❌ Failed to fetch {url} after {retries} attempts")
                    return None
    
    def get_month_url(self, month: int, year: int) -> str:
        """Generate URL for specific month and year."""
        return f"{self.base_url}?month={month}&year={year}"
    
    def extract_events_from_calendar(self, soup: BeautifulSoup, base_url: str) -> List[Event]:
        """Extract events from the calendar view."""
        events = []
        
        # Look for event containers in the calendar
        event_containers = soup.find_all(['div', 'a'], class_=re.compile(r'event', re.I))
        
        for container in event_containers:
            # Try to find event links
            event_links = container.find_all('a', href=re.compile(r'/abu-dhabi-events/'))
            
            for link in event_links:
                event_url = urljoin(base_url, link.get('href', ''))
                title = link.get_text().strip()
                
                if title and event_url and not title.lower() in ['view event', 'export', 'عربي']:
                    # Extract additional information from the link's context
                    parent = link.find_parent()
                    location = ""
                    dates = ""
                    
                    # Try to find date and location info in surrounding text
                    if parent:
                        text = parent.get_text()
                        # Look for date patterns
                        date_matches = re.findall(r'\d{1,2}\s+\w+(?:\s+–\s+\d{1,2}\s+\w+)?', text)
                        if date_matches:
                            dates = date_matches[0]
                        
                        # Look for location patterns (capitalize words after dates)
                        location_matches = re.findall(r'(?:ADNEC|Abu Dhabi|Dubai|Al Dhafra|Sweihan|Al Wathba)[^0-9]*', text)
                        if location_matches:
                            location = location_matches[0].strip()
                    
                    event = Event(
                        title=title,
                        url=event_url,
                        start_date=dates,
                        location=location,
                        view_event_url=event_url
                    )
                    events.append(event)
        
        return events
    
    def extract_events_from_list(self, soup: BeautifulSoup, base_url: str) -> List[Event]:
        """Extract events from the events list section."""
        events = []
        
        # Look for the events list container
        events_container = soup.find('div', class_='calendar-events')
        if not events_container:
            return events
        
        # Find all event entries
        event_items = events_container.find_all('div', class_=re.compile(r'event-item|item'))
        
        if not event_items:
            # Alternative: look for any div containing event links
            event_items = events_container.find_all('div')
        
        for item in event_items:
            # Find the main event link
            event_link = item.find('a', href=re.compile(r'/abu-dhabi-events/'))
            if not event_link:
                continue
            
            title = event_link.get_text().strip()
            event_url = urljoin(base_url, event_link.get('href', ''))
            
            if not title or title.lower() in ['view event', 'export', 'filter']:
                continue
            
            # Extract additional details from the item
            item_text = item.get_text()
            
            # Extract dates
            date_pattern = r'(\d{1,2}\s+\w+(?:\s+–\s+\d{1,2}\s+\w+)?)'
            date_matches = re.findall(date_pattern, item_text)
            start_date = date_matches[0] if date_matches else ""
            
            # Extract location
            location_pattern = r'(ADNEC Abu Dhabi|Abu Dhabi|Dubai World Trade Centre|Al Dhafra Region|Sweihan|Al Wathba)'
            location_matches = re.findall(location_pattern, item_text)
            location = location_matches[0] if location_matches else ""
            
            # Look for "View event" link
            view_link = item.find('a', string=re.compile(r'View event', re.I))
            view_event_url = urljoin(base_url, view_link.get('href', '')) if view_link else event_url
            
            event = Event(
                title=title,
                url=event_url,
                start_date=start_date,
                location=location,
                view_event_url=view_event_url
            )
            events.append(event)
        
        return events
    
    def fetch_events_for_month(self, month: int, year: int) -> List[Event]:
        """Fetch all events for a specific month and year."""
        url = self.get_month_url(month, year)
        html_content = self.fetch_page(url)
        
        if not html_content:
            return []
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract events from both calendar and list views
        calendar_events = self.extract_events_from_calendar(soup, url)
        list_events = self.extract_events_from_list(soup, url)
        
        # Combine and deduplicate events
        all_events = calendar_events + list_events
        unique_events = []
        seen_urls = set()
        
        for event in all_events:
            if event.url not in seen_urls:
                unique_events.append(event)
                seen_urls.add(event.url)
        
        return unique_events
    
    def fetch_events_for_date_range(self, start_month: int, start_year: int, end_month: int, end_year: int) -> List[Event]:
        """Fetch events for a date range."""
        all_events = []
        
        current_month = start_month
        current_year = start_year
        
        while (current_year < end_year) or (current_year == end_year and current_month <= end_month):
            print(f"📅 Fetching events for {current_month:02d}/{current_year}")
            
            month_events = self.fetch_events_for_month(current_month, current_year)
            all_events.extend(month_events)
            
            print(f"  ✅ Found {len(month_events)} events")
            
            # Move to next month
            current_month += 1
            if current_month > 12:
                current_month = 1
                current_year += 1
            
            # Be nice to the server
            time.sleep(1)
        
        return all_events
    
    def save_events_json(self, events: List[Event], filename: str):
        """Save events to JSON file."""
        events_dict = [asdict(event) for event in events]
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(events_dict, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved {len(events)} events to {filename}")
    
    def save_events_csv(self, events: List[Event], filename: str):
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
    parser = argparse.ArgumentParser(description='Fetch Abu Dhabi events data')
    parser.add_argument('--month', type=int, help='Month to fetch (1-12)')
    parser.add_argument('--year', type=int, help='Year to fetch')
    parser.add_argument('--start-month', type=int, help='Start month for range (1-12)')
    parser.add_argument('--start-year', type=int, help='Start year for range')
    parser.add_argument('--end-month', type=int, help='End month for range (1-12)')
    parser.add_argument('--end-year', type=int, help='End year for range')
    parser.add_argument('--output', default='abu_dhabi_events', help='Output filename prefix')
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='both', help='Output format')
    
    args = parser.parse_args()
    
    fetcher = AbuDhabiEventsFetcher()
    
    print("🏙️  Abu Dhabi Events Data Fetcher")
    print("=" * 50)
    
    # Determine what to fetch
    if args.month and args.year:
        # Single month
        print(f"📅 Fetching events for {args.month:02d}/{args.year}")
        events = fetcher.fetch_events_for_month(args.month, args.year)
        output_suffix = f"_{args.year}_{args.month:02d}"
    elif args.start_month and args.start_year and args.end_month and args.end_year:
        # Date range
        print(f"📅 Fetching events from {args.start_month:02d}/{args.start_year} to {args.end_month:02d}/{args.end_year}")
        events = fetcher.fetch_events_for_date_range(args.start_month, args.start_year, args.end_month, args.end_year)
        output_suffix = f"_{args.start_year}_{args.start_month:02d}_to_{args.end_year}_{args.end_month:02d}"
    else:
        # Default: current month
        now = datetime.now()
        print(f"📅 Fetching events for current month: {now.month:02d}/{now.year}")
        events = fetcher.fetch_events_for_month(now.month, now.year)
        output_suffix = f"_{now.year}_{now.month:02d}"
    
    print(f"\n🎉 Total events found: {len(events)}")
    
    if events:
        # Display sample events
        print("\n📋 Sample events:")
        for i, event in enumerate(events[:5], 1):
            print(f"  {i}. {event.title}")
            print(f"     📅 {event.start_date}")
            print(f"     📍 {event.location}")
            print(f"     🔗 {event.url}")
            print()
        
        if len(events) > 5:
            print(f"     ... and {len(events) - 5} more events")
        
        # Save the data
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if args.format in ['json', 'both']:
            json_filename = f"{args.output}{output_suffix}_{timestamp}.json"
            fetcher.save_events_json(events, json_filename)
        
        if args.format in ['csv', 'both']:
            csv_filename = f"{args.output}{output_suffix}_{timestamp}.csv"
            fetcher.save_events_csv(events, csv_filename)
    
    else:
        print("❌ No events found")
    
    print("\n✨ Done!")

if __name__ == "__main__":
    main()