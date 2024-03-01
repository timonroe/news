import { Logger } from '@soralinks/logger';
import {
  NewsScraperType,
  NewsScraperSource,
  NewsScraperResponse,
  NewsScraper,
  NewsScraperFactor,
} from '@soralinks/news-scrapers';
import { ignoreTokens } from './ignore-tokens.js';

const {
  LOGGING_NEWS,
} = process.env;

export const DEFAULT_NUM_TOP_HEADLINES = 20;
export const DEFAULT_NUM_TOP_TOKENS = 20;

export type NewsHeadline = {
  source: string;
  title: string;
  url: string;
};

export type RankedToken = {
  token: string;
  count: number;
};

export type NewsResponse = {
  scraperResponses: NewsScraperResponse[];
  topHeadlines: NewsHeadline[] | undefined;
  topTokens: RankedToken[] | undefined;
};

export class News {
  logger: Logger;

  constructor() {
    if (LOGGING_NEWS && LOGGING_NEWS === 'on') {
      this.logger = new Logger({ logVerbose: true, logError: true });
    } else {
      this.logger = new Logger({ logError: true });
    }
  }

  scoreTitles(scraperResponses: NewsScraperResponse[], rankedTokens: any[]): any[] {
    const headlines = scraperResponses.flatMap(scraperResponse => {
      const { source, headlines } = scraperResponse;
      return headlines.map(headline => {
        // @ts-ignore
        const { titleTokens } = headline;
        // Adding a new field (titleRank) to the NewsScraperHeadline type
        // @ts-ignore
        headline.titleRank = 0;
        titleTokens.forEach((token: any) => {
          const rankedTok = rankedTokens.find(rankedToken => rankedToken.token === token);
          if (rankedTok) {
            const { count } = rankedTok;
            // @ts-ignore
            headline.titleRank += count;
          }
        });
        return {
          source,
          ...headline,
        }
      });
    });
    headlines.sort((firstEl, secondEl) => {
      // @ts-ignore
      if (firstEl.titleRank < secondEl.titleRank) {
        return 1;
      }
      // @ts-ignore
      if (firstEl.titleRank > secondEl.titleRank) {
        return -1;
      }
      return 0;
    });
    return headlines;
  }

  
  rankTokens(tokenizedTitles: string[][][]): any[] {
    const rankedTokens: any[] = [];
    tokenizedTitles.forEach(sourceTokenizedTitles => {
      sourceTokenizedTitles.forEach(titleTokens => {   
        titleTokens.forEach(token => {
          const rankedTok = rankedTokens.find(rankedToken => rankedToken.token === token);
          if (rankedTok) {
            rankedTok.count += 1;
          } else {
            rankedTokens.push({
              token,
              count: 1,
            })
          }
        });
      });
    });
    rankedTokens.sort((firstEl, secondEl) => {
      if (firstEl.count < secondEl.count) {
        return 1;
      }
      if (firstEl.count > secondEl.count) {
        return -1;
      }
      return 0;
    });
    return rankedTokens;
  }

  // Loop through all of the headlines' titles and create tokens for all of the 
  // words in the title. Ignore words that are of no value, eg. the, is, at, etc.
  tokenizeTitles(scraperResponses: NewsScraperResponse[]): string[][][] {
    return scraperResponses.map(scraperResponse => {
      const { headlines } = scraperResponse;
      return headlines.map(headline => {
        const { title } = headline;
        // Adding a new field (titleTokens) to the NewsScraperHeadline type
        // @ts-ignore
        headline.titleTokens = title.split(' ').map(word => {
          const token = word.trim().replace(/’s|'s|[`'‘’:;",.?]/g, '').toLowerCase();
          return !ignoreTokens.includes(token) ? token : undefined;
        }).filter(token => token !== undefined);
        // @ts-ignore
        return headline.titleTokens;
      });
    });
  }
  
  // Scrape the news sources for headlines
  async scrapeHeadlines(
    type: NewsScraperType,
    sources: NewsScraperSource[]
  ): Promise<NewsScraperResponse[]> {
    let responses: NewsScraperResponse[] = [];
    try {
      const factory = new NewsScraperFactor();
      const scrapers = await factory.createScrapers(sources);
      const results = await Promise.allSettled(
        scrapers.map(async (scraper: NewsScraper) => {
          return scraper.scrape(type);
        }),
      );
      // @ts-ignore
      responses = results.map(result => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return undefined;
      }).filter(Boolean);
    } catch (error: any) {
      this.logger.error(`News.scrapeHeadlines() error: ${error.message}`);
      throw error;
    }
    return responses;
  }

  // Main entry point into the News class
  // Get headlines for: type (eg. politics), sources (eg. fox, cnn, etc.)
  async getHeadlines(params: {
    type: NewsScraperType,
    sources: NewsScraperSource[],
    options?: {
      topHeadlinesCount?: number,
      topTokensCount?: number,
    },
  }): Promise<NewsResponse> {
    const { type, sources, options } = params;
    let topHeadlinesCount = DEFAULT_NUM_TOP_HEADLINES;
    let topTokensCount = DEFAULT_NUM_TOP_TOKENS;
    if (options) {
      if (options.topHeadlinesCount !== undefined && options.topHeadlinesCount >= 0) {
        topHeadlinesCount = options.topHeadlinesCount;
      }
      if (options.topTokensCount !== undefined && options.topTokensCount >= 0) {
        topTokensCount = options.topTokensCount;
      }
    }

    const scraperResponses: NewsScraperResponse[] = await this.scrapeHeadlines(type, sources);
    if (!options || (!options.topHeadlinesCount && !options.topTokensCount)) {
      return {
        scraperResponses: scraperResponses,
        topHeadlines: undefined,
        topTokens: undefined,
      };
    }

    const tokenizedTitles: string[][][] = this.tokenizeTitles(scraperResponses);
    this.logger.verbose(`News.getHeadlines: tokenizedTitles: %s`, JSON.stringify(tokenizedTitles, null, 2));

    const rankedTokens: RankedToken[] = this.rankTokens(tokenizedTitles);
    const topRankedTokens: RankedToken[] = []
    for(let x = 0; x < topTokensCount && rankedTokens.length > x; x++) {
      topRankedTokens.push(rankedTokens[x]);
    }
    this.logger.verbose(`News.getHeadlines: top${topTokensCount}Tokens: %s`, JSON.stringify(topRankedTokens, null, 2));

    const scoredTitles: any[] = this.scoreTitles(scraperResponses, rankedTokens);
    this.logger.verbose(`News.getHeadlines: scoredTitles: %s`, JSON.stringify(scoredTitles, null, 2));

    const rankedHeadlines: NewsHeadline[] = scoredTitles.map(({ source, title, url }) => { return { source, title, url } });
    const topRankedHeadlines: NewsHeadline[] = []
    for(let x = 0; x < topHeadlinesCount && rankedHeadlines.length > x; x++) {
      topRankedHeadlines.push(rankedHeadlines[x]);
    }
    this.logger.verbose(`News.getHeadlines: top${topHeadlinesCount}Headlines: %s`, JSON.stringify(topRankedHeadlines, null, 2));

    return {
      scraperResponses: scraperResponses,
      topHeadlines: topRankedHeadlines.length ? topRankedHeadlines : undefined,
      topTokens: topRankedTokens.length ? topRankedTokens : undefined,
    }
  }
}
