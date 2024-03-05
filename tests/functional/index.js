import 'dotenv/config';
import { NewsScraperType, NewsScraperSource } from '@soralinks/news-scrapers';
import { DEFAULT_NUM_TOP_HEADLINES, DEFAULT_NUM_TOP_TOKENS, News } from '../../index.js';
import ignoreTokensFile from '../../lambdas/post-ignore-tokens/ignore-tokens.json' assert { type: "json" };
const { ignoreTokens } = ignoreTokensFile;
import multiWordTokensFile from '../../lambdas/post-multi-word-tokens/multi-word-tokens.json' assert { type: "json" };
const { multiWordTokens } = multiWordTokensFile;
import synonymTokensFile from '../../lambdas/post-synonym-tokens/synonym-tokens.json' assert { type: "json" };
const { synonymTokens } = synonymTokensFile;
(async () => {
    const news = new News();
    const newsResponse = await news.getHeadlines({
        type: NewsScraperType.POLITICS,
        sources: [...Object.values(NewsScraperSource).map(source => source)],
        ignoreTokens,
        multiWordTokens,
        synonymTokens,
        options: {
            topHeadlinesCount: DEFAULT_NUM_TOP_HEADLINES,
            topTokensCount: DEFAULT_NUM_TOP_TOKENS,
        },
    });
    console.log(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
})();
