# news
News utility

## Install

`npm install @soralinks/news`

## Use in your app

```javascript
import {
  NewsScraperType,
  NewsScraperSource,
} from '@soralinks/news-scrapers';
import { News, NewsResponse } from '@soralinks/news';

const news: News = new News();
const newsResponse: NewsResponse = await news.getHeadlines({
  type: NewsScraperType.POLITICS,
  sources: [NewsScraperSource.AP, NewsScraperSource.CNN, NewsScraperSource.FOX, NewsScraperSource.WASH_EXAM],
  topHeadlines: {
    count: 20,
  },
});
console.log(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
```

## Logging
```javascript
// To turn on logging, set the environment variable: LOGGING_NEWS = 'on'
// Note that error logging is always on

```
