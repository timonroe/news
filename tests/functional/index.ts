import 'dotenv/config';
import {
  NewsScraperType,
  NewsScraperSource,
  NewsScraperResponse
} from '@soralinks/news-scrapers';
import {
  NewsHeadline,
  RankedToken,
  News
} from '../../index.js';

import ignoreTokensFile from '../../lambdas/post-ignore-tokens/ignore-tokens.json' assert { type: "json" };
const { ignoreTokens } = ignoreTokensFile;
import multiWordTokensFile from '../../lambdas/post-multi-word-tokens/multi-word-tokens.json' assert { type: "json" };
const { multiWordTokens } = multiWordTokensFile;
import synonymTokensFile from '../../lambdas/post-synonym-tokens/synonym-tokens.json' assert { type: "json" };
const { synonymTokens } = synonymTokensFile;

const {
  NEWS_DEFAULT_NUM_TOP_HEADLINES,
  NEWS_DEFAULT_NUM_TOP_TOKENS,
} = process.env;

(async () => {
  // @ts-ignore
  const topHeadlinesCount = parseInt(NEWS_DEFAULT_NUM_TOP_HEADLINES, 10);
  // @ts-ignore
  const topTokensCount = parseInt(NEWS_DEFAULT_NUM_TOP_TOKENS, 10);

  // Get the headlines from the news sources
  const news: News = new News();
  const type = NewsScraperType.POLITICS;
  const sources = [...Object.values(NewsScraperSource).map(source => source)];
  const scraperResponses: NewsScraperResponse[] = await news.scrapeHeadlines(type, sources);
  // console.log(`scraperResponses: ${JSON.stringify(scraperResponses, null, 2)}`);

  // Tokenize the titles
  const tokenizedTitles: string[][][] = news.tokenizeTitles({
    scraperResponses,
    ignoreTokens,
    multiWordTokens,
    synonymTokens,
  });
  // console.log(`tokenizedTitles: ${JSON.stringify(tokenizedTitles, null, 2)}`);

  // Rank the tokens
  const rankedTokens: RankedToken[] = news.rankTokens(tokenizedTitles);
  // console.log(`rankedTokens: ${JSON.stringify(rankedTokens, null, 2)}`);

  // Get the top ranked tokens
  const topRankedTokens: RankedToken[] = []
  for(let x = 0; x < topTokensCount && rankedTokens.length > x; x++) {
    topRankedTokens.push(rankedTokens[x]);
  }
  console.log(`top${topTokensCount}Tokens: ${JSON.stringify(topRankedTokens, null, 2)}`);

  // Score the titles based on the ranked tokens
  const scoredTitles: any[] = news.scoreTitles(scraperResponses, rankedTokens);
  // console.log(`scoredTitles: ${JSON.stringify(scoredTitles, null, 2)}`);

  // Get the top ranked headlines
  const rankedHeadlines: NewsHeadline[] = scoredTitles.map(({ source, title, url }) => { return { source, title, url } });
  const topRankedHeadlines: NewsHeadline[] = []
  for(let x = 0; x < topHeadlinesCount && rankedHeadlines.length > x; x++) {
    topRankedHeadlines.push(rankedHeadlines[x]);
  }
  console.log(`top${topHeadlinesCount}Headlines: ${JSON.stringify(topRankedHeadlines, null, 2)}`);

})();
