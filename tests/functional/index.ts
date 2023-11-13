import 'dotenv/config';
import { News } from '../../index.js';

(async () => {
  const news: News = new News();
  const headlines: string[] = await news.getHeadlines();
  console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
