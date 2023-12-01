import 'dotenv/config';
import { 
  NewsScraperSource,
  NewsScraperType,
} from '@soralinks/news-scrapers';
import { News, NewsResponse } from '../../index.js';

(async () => {
  const news: News = new News();
  const results: NewsResponse = await news.getHeadlines({
    type: NewsScraperType.POLITICS,
    sources: [NewsScraperSource.AP, NewsScraperSource.CNN, NewsScraperSource.FOX, NewsScraperSource.WASH_EXAM],
    topHeadlines: {
      count: 20,
    },
  });
  console.log(`results: ${JSON.stringify(results, null, 2)}`);
})();
