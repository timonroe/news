import 'dotenv/config';
import {
  NewsScraperType,
  NewsScraperResponse,
} from '@soralinks/news-scrapers';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const headlines: NewsScraperResponse[] = await news.getHeadlines(NewsScraperType.POLITICS);
  console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
