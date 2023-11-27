# news
News utility

## Install

`npm install @soralinks/news`

## Use in your app

```javascript
import { NewsScraperResponseHeadline } from '@soralinks/news-scrapers';
import { NewsScraperType } from '@soralinks/news-scrapers';
import { News } from '@soralinks/news';

const news: News = new News();
const headlines: NewsScraperResponseHeadline[] = await news.getHeadlines(NewsScraperType.POLITICS);
console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
```

## Logging
```javascript
// To turn on logging, set the environment variable: LOGGING_NEWS = 'on'
// Note that error logging is always on

```
