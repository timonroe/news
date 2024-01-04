import 'dotenv/config';
import { NewsScraperType, NewsScraperSource } from '@soralinks/news-scrapers';
import { News } from '../../index.js';
(async () => {
    const news = new News();
    const newsResponse = await news.getHeadlines({
        type: NewsScraperType.POLITICS,
        sources: [...Object.values(NewsScraperSource).map(source => source)],
        topHeadlines: {
            count: 20,
        },
    });
    console.log(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
})();
