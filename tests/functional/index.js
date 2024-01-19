import 'dotenv/config';
import { NewsScraperType, NewsScraperSource } from '@soralinks/news-scrapers';
import { DEFAULT_NUM_TOP_HEADLINES, DEFAULT_NUM_TOP_TOKENS, News } from '../../index.js';
(async () => {
    const news = new News();
    const newsResponse = await news.getHeadlines({
        type: NewsScraperType.POLITICS,
        sources: [...Object.values(NewsScraperSource).map(source => source)],
        options: {
            topHeadlinesCount: DEFAULT_NUM_TOP_HEADLINES,
            topTokensCount: DEFAULT_NUM_TOP_TOKENS,
        },
    });
    console.log(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
})();
