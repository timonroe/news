import { Logger } from '@soralinks/logger';
import {
  NewsScraperType,
  NewsScraperSource,
  NewsScraperResponse,
  NewsScraper,
  NewsScraperFactor,
} from '@soralinks/news-scrapers';

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

const MIN_TOKEN_COUNT = 2;

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
            // If the title has a bunch of words (tokens) that have a small count we want to
            // exclude those from the title's rank. This prevents titles that have a bunch of
            // low value words from getting ranked too high.
            if (count >= MIN_TOKEN_COUNT) {
              // @ts-ignore
              headline.titleRank += count;
            }
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
  tokenizeTitles(params: {
    scraperResponses: NewsScraperResponse[],
    ignoreTokens?: string[],
    multiWordTokens?: string[],
    synonymTokens?: object[],
  }): string[][][] {
    const { scraperResponses } = params;

    // Validate the tokens getting passed in
    let { ignoreTokens, multiWordTokens, synonymTokens } = params;
    ignoreTokens = ignoreTokens && Array.isArray(ignoreTokens) && ignoreTokens.length ? ignoreTokens : undefined;
    multiWordTokens = multiWordTokens && Array.isArray(multiWordTokens) && multiWordTokens.length ? multiWordTokens : undefined;
    synonymTokens = synonymTokens && Array.isArray(synonymTokens) && synonymTokens.length ? synonymTokens : undefined;

    return scraperResponses.map(scraperResponse => {
      const { headlines } = scraperResponse;
      return headlines.map(headline => {
        const { title } = headline;
        const titleTokens: string[] = [];

        // Tokenize the tile, remove the uneeded ignore tokens
        let tokenizedTitle = title.split(' ').map(word => {
          const token = word.trim().replace(/’s|'s|[`'‘’:;",.?]/g, '').toLowerCase(); // convert the word to a token
          return ignoreTokens && ignoreTokens.includes(token) ? undefined : token;
        }).filter(token => token !== undefined).join(' ');

        // Extract the multi-word tokens from the tokenizedTitle and add them to the titleTokens
        // Note: this step must come before the synonymTokens step below
        if (multiWordTokens) {
          multiWordTokens.forEach(multiWordToken => {
            const idx = tokenizedTitle.indexOf(multiWordToken);
            // If we find the token in the tokenizedTitle
            if (idx !== -1) {
              titleTokens.push(multiWordToken);
              // Remove *all* instances of the token from the tokenizedTitle
              const regex = new RegExp(multiWordToken, 'g');
              tokenizedTitle = tokenizedTitle.replace(regex, '');
            }
          });
        }

        // Extract the synonym tokens from the tokenizedTitle and add them to the titleTokens
        if (synonymTokens) {
          synonymTokens.forEach(entry => {
            // Loop through all of the synonym tokens
            for (const [synonymToken, valueTokens] of Object.entries(entry)) {
              let addedSynonymToken = false;
              // Loop through all of the values tokens for this synonym token
              valueTokens.forEach((valueToken: string) => {
                const idx = tokenizedTitle.indexOf(valueToken);
                // If we find the token in the tokenizedTitle
                if (idx !== -1) {
                  // Add the synonymToken *once* to the titleTokens array
                  if (!addedSynonymToken) {
                    titleTokens.push(synonymToken);
                    addedSynonymToken = true;
                  }
                  // Remove *all* instances of the token from the tokenizedTitle
                  const regex = new RegExp(valueToken, 'g');
                  tokenizedTitle = tokenizedTitle.replace(regex, '');
                }
              });
            }
          });
        }

        // Add the remaining tokens in the tokenizedTitle to the titleTokens array
        tokenizedTitle.split(' ').map(token => {
          if (token) titleTokens.push(token);
        });

        // Adding a new field (titleTokens) to the NewsScraperHeadline type
        // @ts-ignore
        headline.titleTokens = titleTokens;
        
        return titleTokens;
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
    ignoreTokens?: string[],
    multiWordTokens?: string[],
    synonymTokens?: object[],
    options?: {
      topHeadlinesCount?: number,
      topTokensCount?: number,
    },
  }): Promise<NewsResponse> {
    const { type, sources, ignoreTokens, multiWordTokens, synonymTokens, options } = params;
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

    const tokenizedTitles: string[][][] = this.tokenizeTitles({
      scraperResponses,
      ignoreTokens,
      multiWordTokens,
      synonymTokens,
    });
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
