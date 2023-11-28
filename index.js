import { Logger } from '@soralinks/logger';
import { APScraper, CNNScraper, FoxScraper } from '@soralinks/news-scrapers';
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
            const { headlines } = scraperResponse;
            return headlines.map(headline => {
                // @ts-ignore
                const { titleTokens } = headline;
                // Adding a new field (titleRank) to the NewsScraperResponseHeadline type
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
                return headline;
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
                // Adding a new field (titleTokens) to the NewsScraperResponseHeadline type
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
    async scrapeHeadlines(type) {
        let responses = [];
        try {
            const apScraper = new APScraper();
            const cnnScraper = new CNNScraper();
            const foxScraper = new FoxScraper();
            const scrapers = [
                apScraper,
                cnnScraper,
                foxScraper,
            ];
            const results = await Promise.allSettled(scrapers.map(async (scraper) => {
                return scraper.scrape(type);
            }));
            responses = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return {
                    source: '',
                    type: '',
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
    async getHeadlines(type, count = DEFAULT_NUM_HEADLINES) {
        if (typeof count !== 'number' || count < 1) {
            throw new Error('count must be a number greater than 0');
        }
        const scraperResponses = await this.scrapeHeadlines(type);
        const tokenizedTitles = this.tokenizeTitles(scraperResponses);
        this.logger.verbose(`News.getHeadlines: tokenizedTitles: %s`, JSON.stringify(tokenizedTitles, null, 2));
        const rankedTokens = this.rankTokens(tokenizedTitles);
        this.logger.verbose(`News.getHeadlines: rankedTokens: %s`, JSON.stringify(rankedTokens, null, 2));
        const headlines = this.scoreTitles(scraperResponses, rankedTokens);
        const topHeadlines = [];
        for (let x = 0; x < count && headlines.length > x; x++) {
            topHeadlines.push(headlines[x]);
        }
        this.logger.verbose(`News.getHeadlines: top${count}Headlines: %s`, JSON.stringify(topHeadlines, null, 2));
        return topHeadlines;
    }
}
