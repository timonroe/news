import 'dotenv/config';
import { 
  NewsScraperSource,
  NewsScraperType,
} from '@soralinks/news-scrapers';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const results = await news.getHeadlines({
    type: NewsScraperType.POLITICS,
    sources: [NewsScraperSource.AP, NewsScraperSource.CNN, NewsScraperSource.FOX, NewsScraperSource.WASH_EXAM],
    topHeadlines: {
      count: 20,
    },
  });
  console.log(`results: ${JSON.stringify(results, null, 2)}`);
})();
