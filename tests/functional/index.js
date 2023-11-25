import 'dotenv/config';
import { NewsScraperType, } from '@soralinks/news-scrapers';
import { News } from '../../index.js';
(async () => {
    const news = new News();
    const headlines = await news.getHeadlines(NewsScraperType.POLITICS);
    console.log(`headlines: ${JSON.stringify(headlines, null, 2)}`);
})();
