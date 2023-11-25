import { Logger } from '@soralinks/logger';
import { CNNScraper, FoxScraper } from '@soralinks/news-scrapers';
// import OpenAI from 'openai';
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
    /*
    async summarizeHeadlines(headlines: string[]): Promise<string[]> {
      let prompt = 'Given the following news headlines:\n\n';
      prompt += headlines.join('\n');
      prompt += `\n\nProduce a summarized list of headlines, no more than 10, that best represents all of the headlines.\n\n`;
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
      const params: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-3.5-turbo',
      };
      let completion: OpenAI.Chat.ChatCompletion;
      try {
        completion = await openai.chat.completions.create(params);
      } catch (error: any) {
        this.logger.error('News.summarizeHeadlines error: %s', error.message);
        throw error;
      }
      const { choices = [] } = completion;
      if (!choices.length) return [];
      const { message } = choices[0];
      if (!message) return [];
      const { content } = message;
      if (!content) return [];
      const summary = content.split('\n');
      return summary;
    }
    */
    async scrapeHeadlines(type) {
        let responses = [];
        try {
            const cnnScraper = new CNNScraper();
            const foxScraper = new FoxScraper();
            const scrapers = [
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
    async getHeadlines(type) {
        const responses = await this.scrapeHeadlines(type);
        this.logger.verbose(`News.getHeadlines: %s`, JSON.stringify(responses, null, 2));
        return responses;
    }
}
