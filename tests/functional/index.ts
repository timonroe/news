import 'dotenv/config';
import { NewsScraperResponseHeadline } from '@soralinks/news-scrapers';
import { NewsScraperType } from '@soralinks/news-scrapers';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const headlines: NewsScraperResponseHeadline[] = await news.getHeadlines(NewsScraperType.POLITICS);
  console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
