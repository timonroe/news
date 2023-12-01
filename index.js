import { Logger } from '@soralinks/logger';
import { NewsScraperSource, APScraper, CNNScraper, FoxScraper, WashExamScraper, } from '@soralinks/news-scrapers';
import { ignoreTokens } from './ignore-tokens.js';
const { LOGGING_NEWS, } = process.env;
const DEFAULT_NUM_HEADLINES = 20;
export class News {
    logger;
    constructor() {
        if (LOGGING_NEWS && LOGGING_NEWS === 'on') {
            this.logger = new Logger({ logVerbose: true, logError: true });
        }
        else {
            this.logger = new Logger({ logError: true });
        }
    }
    scoreTitles(scraperResponses, rankedTokens) {
        const headlines = scraperResponses.flatMap(scraperResponse => {
            const { source, headlines } = scraperResponse;
            return headlines.map(headline => {
                // @ts-ignore
                const { titleTokens } = headline;
                // Adding a new field (titleRank) to the NewsScraperHeadline type
                // @ts-ignore
                headline.titleRank = 0;
                titleTokens.forEach((token) => {
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
                };
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
    rankTokens(tokenizedTitles) {
        const rankedTokens = [];
        tokenizedTitles.forEach(sourceTokenizedTitles => {
            sourceTokenizedTitles.forEach(titleTokens => {
                titleTokens.forEach(token => {
                    const rankedTok = rankedTokens.find(rankedToken => rankedToken.token === token);
                    if (rankedTok) {
                        rankedTok.count += 1;
                    }
                    else {
                        rankedTokens.push({
                            token,
                            count: 1,
                        });
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
    tokenizeTitles(scraperResponses) {
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
    createScrapers(sources) {
        return sources.map(source => {
            if (source === NewsScraperSource.AP)
                return new APScraper();
            else if (source === NewsScraperSource.CNN)
                return new CNNScraper();
            else if (source === NewsScraperSource.FOX)
                return new FoxScraper();
            else if (source === NewsScraperSource.WASH_EXAM)
                return new WashExamScraper();
            else
                throw new Error(`news scraper source: ${source} is invalid`);
        });
    }
    async scrapeHeadlines(type, sources) {
        let responses = [];
        try {
            const scrapers = this.createScrapers(sources);
            const results = await Promise.allSettled(scrapers.map(async (scraper) => {
                return scraper.scrape(type);
            }));
            // @ts-ignore
            responses = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return {
                    headlines: [],
                };
            });
            responses = responses.filter(response => response.headlines.length);
        }
        catch (error) {
            this.logger.error(`News.scrapeHeadlines() error: ${error.message}`);
            throw error;
        }
        return responses;
    }
    async getHeadlines(params) {
        const { type, sources, topHeadlines } = params;
        let count;
        if (topHeadlines) {
            count = topHeadlines.count;
            if (count === undefined || (typeof count !== 'number' || count < 1)) {
                throw new Error('count must be a number greater than 0');
            }
        }
        const scraperResponses = await this.scrapeHeadlines(type, sources);
        if (!topHeadlines) {
            return {
                scraperResponses: scraperResponses,
                topHeadlines: undefined,
            };
        }
        const tokenizedTitles = this.tokenizeTitles(scraperResponses);
        this.logger.verbose(`News.getHeadlines: tokenizedTitles: %s`, JSON.stringify(tokenizedTitles, null, 2));
        const rankedTokens = this.rankTokens(tokenizedTitles);
        this.logger.verbose(`News.getHeadlines: rankedTokens: %s`, JSON.stringify(rankedTokens, null, 2));
        const scoredTitles = this.scoreTitles(scraperResponses, rankedTokens);
        this.logger.verbose(`News.getHeadlines: scoredTitles: %s`, JSON.stringify(scoredTitles, null, 2));
        const headlines = scoredTitles.map(({ source, title, url }) => { return { source, title, url }; });
        const topRankedHeadlines = [];
        // @ts-ignore
        for (let x = 0; x < count && headlines.length > x; x++) {
            topRankedHeadlines.push(headlines[x]);
        }
        this.logger.verbose(`News.getHeadlines: top${count}Headlines: %s`, JSON.stringify(topRankedHeadlines, null, 2));
        return {
            scraperResponses: scraperResponses,
            topHeadlines: topRankedHeadlines,
        };
    }
}
