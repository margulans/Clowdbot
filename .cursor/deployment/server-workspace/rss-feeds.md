# RSS Feeds Configuration

## Priority RSS Sources

### Technology & AI
- **TechCrunch**: https://feeds.feedburner.com/TechCrunch
- **MIT Technology Review**: https://www.technologyreview.com/feed/
- **Wired**: https://www.wired.com/feed/rss
- **The Verge**: https://www.theverge.com/rss/index.xml
- **OpenAI Blog**: https://openai.com/blog/rss.xml
- **Google AI Blog**: https://blog.google/technology/ai/rss/

### Robotics & Automation  
- **IEEE Robotics**: https://spectrum.ieee.org/feeds/topic/robotics.rss
- **Robohub**: https://robohub.org/feed/
- **Robotics Business Review**: https://www.roboticsbusinessreview.com/feed/

### eVTOL & Aviation
- **eVTOL.com**: https://evtol.com/feed/
- **FlightGlobal**: https://www.flightglobal.com/rss/news/all-news/rss.xml
- **AVWeb**: https://www.avweb.com/rss.xml

### Business & Startups
- **Crunchbase**: https://news.crunchbase.com/feed/
- **Product Hunt**: https://www.producthunt.com/feed
- **Hacker News**: https://hnrss.org/frontpage

### Russian Sources
- **Хабр**: https://habr.com/ru/rss/hub/artificial_intelligence/
- **VC.ru**: https://vc.ru/rss

## Feed Categories
```javascript
const feedCategories = {
  'high_priority': ['openai', 'techcrunch', 'mit-tech-review'],
  'robotics': ['ieee-robotics', 'robohub'],
  'aviation': ['evtol', 'flightglobal'],
  'business': ['crunchbase', 'product-hunt', 'vc-ru']
};
```

## Update Frequency
- High priority: Every 2 hours
- Standard: Every 4 hours  
- Low priority: Twice daily