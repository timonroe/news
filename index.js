import { Logger } from '@soralinks/logger';
import { CNNScraper } from '@soralinks/news-scrapers';
import OpenAI from 'openai';
const { LOGGING_NEWS, OPENAI_API_KEY, } = process.env;
export class News {
    logger;
    constructor() {
        if (LOGGING_NEWS && LOGGING_NEWS === 'on') {
            this.logger = new Logger({ logVerbose: true, logError: true });
        }
        else {
            this.logger = new Logger({ logError: true });
        }
        if (!OPENAI_API_KEY) {
            throw new Error('must specify OPENAI_API_KEY as an environment variable');
        }
    }
    async summarizeHeadlines(headlines) {
        let prompt = 'Given the following news headlines:\n\n';
        prompt += headlines.join('\n');
        prompt += `\n\nProduce a summarized list of headlines, no more than 5, that best represents all of the headlines.\n\n`;
        const openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });
        const params = {
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-3.5-turbo',
        };
        let completion;
        try {
            completion = await openai.chat.completions.create(params);
        }
        catch (error) {
            this.logger.error('News.summarizeHeadlines error: %s', error.message);
            throw error;
        }
        const { choices = [] } = completion;
        if (!choices.length)
            return [];
        const { message } = choices[0];
        if (!message)
            return [];
        const { content } = message;
        if (!content)
            return [];
        const summary = content.split('\n');
        return summary;
    }
    async scrapeHeadlines() {
        const headlines = [];
        try {
            const cnnScraper = new CNNScraper();
            const cnnHeadlines = await cnnScraper.scrape();
            headlines.push(...cnnHeadlines);
        }
        catch (error) {
            this.logger.error(`News.scrapeHeadlines() error: ${error.message}`);
            throw error;
        }
        return headlines;
    }
    async getHeadlines() {
        const headlines = await this.scrapeHeadlines();
        const summary = await this.summarizeHeadlines(headlines);
        this.logger.verbose(`News.getHeadlines: %s`, JSON.stringify(summary, null, 2));
        return summary;
    }
}
