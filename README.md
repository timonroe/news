# news
News utility

## Install

`npm install @soralinks/news`

## Use in your app

```javascript
import {
  NewsScraperType,
  NewsScraperSource,
  NewsScraperResponse
} from '@soralinks/news-scrapers';
import { News } from '@soralinks/news';

(async () => {
  const news = new News();
    const type = NewsScraperType.POLITICS;
    const sources = [...Object.values(NewsScraperSource).map(source => source)];
    const scraperResponses = await news.scrapeHeadlines(type, sources);
    console.log(`scraperResponses: ${JSON.stringify(scraperResponses, null, 2)}`);
})();
```

## Logging
```javascript
// To turn on logging, set the environment variable: LOGGING_NEWS = 'on'
// Note that error logging is always on

```
