import 'dotenv/config';
import { 
  NewsScraperType,
  NewsScraperResponseHeadline
} from '@soralinks/news-scrapers';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const headlines: NewsScraperResponseHeadline[] = await news.getHeadlines(NewsScraperType.POLITICS, 10);
  console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
