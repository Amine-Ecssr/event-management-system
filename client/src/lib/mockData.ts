import { Event } from './types';

//todo: remove mock functionality
export const mockEvents: Event[] = [
  {
    id: '1',
    name: 'International Tech Summit 2025',
    description: 'Join industry leaders and innovators for three days of cutting-edge technology discussions, workshops, and networking opportunities.',
    startDate: '2025-01-15',
    endDate: '2025-01-17',
    location: 'Convention Center',
    url: 'https://example.com/tech-summit',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Technology'
  },
  {
    id: '2',
    name: 'Art & Design Expo',
    description: 'Experience the finest contemporary art and design from local and international artists.',
    startDate: '2025-02-08',
    endDate: '2025-02-10',
    location: 'City Art Gallery',
    url: 'https://example.com/art-expo',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Arts'
  },
  {
    id: '3',
    name: 'Spring Music Festival',
    description: 'A celebration of music featuring performances from classical orchestras to modern bands.',
    startDate: '2025-03-22',
    endDate: '2025-03-24',
    location: 'Outdoor Amphitheater',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Music'
  },
  {
    id: '4',
    name: 'Global Business Forum',
    description: 'Connect with business leaders, entrepreneurs, and investors from around the world.',
    startDate: '2025-04-10',
    endDate: '2025-04-12',
    location: 'Grand Hotel Conference Hall',
    url: 'https://example.com/business-forum',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Business'
  },
  {
    id: '5',
    name: 'Culinary Arts Masterclass',
    description: 'Learn from world-renowned chefs in this exclusive hands-on cooking experience.',
    startDate: '2025-05-05',
    endDate: '2025-05-05',
    location: 'Culinary Institute',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Food'
  },
  {
    id: '6',
    name: 'Summer Sports Championship',
    description: 'Watch elite athletes compete in various sports disciplines throughout the week.',
    startDate: '2025-06-18',
    endDate: '2025-06-25',
    location: 'National Stadium',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Sports'
  },
  {
    id: '7',
    name: 'Innovation & Startups Conference',
    description: 'Discover the latest innovations and connect with promising startups and investors.',
    startDate: '2025-07-14',
    endDate: '2025-07-15',
    location: 'Tech Hub Center',
    url: 'https://example.com/innovation',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Technology'
  },
  {
    id: '8',
    name: 'Photography Exhibition',
    description: 'A stunning showcase of contemporary photography from award-winning photographers.',
    startDate: '2025-08-03',
    endDate: '2025-08-10',
    location: 'Museum of Modern Art',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Arts'
  },
  {
    id: '9',
    name: 'Film Festival',
    description: 'Premieres, screenings, and Q&A sessions with acclaimed filmmakers from around the globe.',
    startDate: '2025-09-12',
    endDate: '2025-09-19',
    location: 'City Cinema Complex',
    url: 'https://example.com/film-fest',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Entertainment'
  },
  {
    id: '10',
    name: 'Health & Wellness Summit',
    description: 'Expert talks on nutrition, fitness, mental health, and holistic wellness practices.',
    startDate: '2025-10-20',
    endDate: '2025-10-22',
    location: 'Wellness Center',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Health'
  },
  {
    id: '11',
    name: 'Book Fair & Literary Festival',
    description: 'Meet bestselling authors, attend readings, and discover new literary works.',
    startDate: '2025-11-08',
    endDate: '2025-11-10',
    location: 'Central Library',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Literature'
  },
  {
    id: '12',
    name: 'Winter Gala & Charity Auction',
    description: 'An elegant evening of fine dining, entertainment, and fundraising for local charities.',
    startDate: '2025-12-14',
    endDate: '2025-12-14',
    location: 'Grand Ballroom',
    url: 'https://example.com/winter-gala',
    eventType: "local" as const,
    eventScope: "external" as const,
    category: 'Charity'
  }
];
