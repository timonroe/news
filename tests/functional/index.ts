import 'dotenv/config';
import {
  NewsScraperType,
  NewsScraperSource,
} from '@soralinks/news-scrapers';
import { News, NewsResponse } from '../../index.js';

(async () => {
  const news: News = new News();
  const newsResponse: NewsResponse = await news.getHeadlines({
    type: NewsScraperType.POLITICS,
    sources: [NewsScraperSource.AP, NewsScraperSource.CNN, NewsScraperSource.FOX, NewsScraperSource.WASH_EXAM],
    topHeadlines: {
      count: 20,
    },
  });
  console.log(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
})();
