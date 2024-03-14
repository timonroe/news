import { Logger } from '@soralinks/logger';
import { NewsScraperFactor, } from '@soralinks/news-scrapers';
const { LOGGING_NEWS, } = process.env;
const MIN_TOKEN_COUNT = 2;
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
                    const rankedTok = rankedTokens.find(rankedToken => rankedToken.token === token); // case-sensitive search
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
                    const rankedTok = rankedTokens.find(rankedToken => rankedToken.token === token); // case-sensitive search
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
    // Loop through all of the headlines' titles and create tokens for all of the 
    // words in the title. Ignore words that are of no value, eg. the, is, at, etc.
    tokenizeTitles(params) {
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
                const titleTokens = [];
                // Tokenize the tile
                let tokenizedTitle = title.split(' ').map(word => {
                    // Convert the word to a token, removing commas, punctuation, etc.
                    return word.trim().replace(/’s|'s|[`'‘’:;",.?]/g, '');
                }).filter(token => token !== '').join(' ');
                // Extract the multi-word tokens from the tokenizedTitle and add them to the titleTokens
                // Note: this step must come before the synonymTokens step below
                if (multiWordTokens) {
                    multiWordTokens.forEach(multiWordToken => {
                        const idx = tokenizedTitle.indexOf(multiWordToken); // case-sensitive search
                        // If we find the token in the tokenizedTitle
                        if (idx !== -1) {
                            titleTokens.push(multiWordToken);
                            // Remove *all* instances of the token from the tokenizedTitle
                            const regex = new RegExp(multiWordToken, 'g');
                            tokenizedTitle = tokenizedTitle.replace(regex, ''); // case-sensitive string replace
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
                            valueTokens.forEach((valueToken) => {
                                const idx = tokenizedTitle.indexOf(valueToken); // case-sensitive search
                                // If we find the token in the tokenizedTitle
                                if (idx !== -1) {
                                    // Add the synonymToken *once* to the titleTokens array
                                    if (!addedSynonymToken) {
                                        titleTokens.push(synonymToken);
                                        addedSynonymToken = true;
                                    }
                                    // Remove *all* instances of the token from the tokenizedTitle
                                    const regex = new RegExp(valueToken, 'g');
                                    tokenizedTitle = tokenizedTitle.replace(regex, ''); // case-sensitive string replace
                                }
                            });
                        }
                    });
                }
                // Remove the uneeded ignore tokens from the tokenizedTitle
                tokenizedTitle = tokenizedTitle.split(' ').map(token => {
                    return ignoreTokens && ignoreTokens.includes(token) ? undefined : token; // case-sensitive search
                }).filter(token => token !== undefined).join(' ');
                // Add the remaining tokens in the tokenizedTitle to the titleTokens array
                tokenizedTitle.split(' ').map(token => {
                    if (token)
                        titleTokens.push(token);
                });
                // Adding a new field (titleTokens) to the NewsScraperHeadline type
                // @ts-ignore
                headline.titleTokens = titleTokens;
                return titleTokens;
            });
        });
    }
    // Scrape the news sources for headlines
    async scrapeHeadlines(type, sources) {
        let responses = [];
        try {
            const factory = new NewsScraperFactor();
            const scrapers = await factory.createScrapers(sources);
            const results = await Promise.allSettled(scrapers.map(async (scraper) => {
                return scraper.scrape(type);
            }));
            // @ts-ignore
            responses = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return undefined;
            }).filter(Boolean);
        }
        catch (error) {
            this.logger.error(`News.scrapeHeadlines() error: ${error.message}`);
            throw error;
        }
        return responses;
    }
}
