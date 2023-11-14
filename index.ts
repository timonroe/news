import { Logger } from '@soralinks/logger';
import { CNNScraper, FoxScraper } from '@soralinks/news-scrapers';
import OpenAI from 'openai';

const {
  LOGGING_NEWS,
  OPENAI_API_KEY,
} = process.env;

export class News {
  logger: Logger;

  constructor() {
    if (LOGGING_NEWS && LOGGING_NEWS === 'on') {
      this.logger = new Logger({ logVerbose: true, logError: true });
    } else {
      this.logger = new Logger({ logError: true });
    }
    if (!OPENAI_API_KEY) {
      throw new Error('must specify OPENAI_API_KEY as an environment variable');
    }
  }

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
  
  async scrapeHeadlines(): Promise<string[]> {
    const headlines: string[] = [];
    try {
      const cnnScraper: CNNScraper = new CNNScraper();
      const foxScraper: FoxScraper = new FoxScraper();
      const scrapers = [
        cnnScraper,
        foxScraper,
      ];
      const results = await Promise.allSettled(
        scrapers.map(async (scraper) => {
          return scraper.scrape();
        }),
      );
      const responses = results.map(result => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return undefined;
      }).filter(Boolean);
      responses.forEach(response => {
        if (response) {
          headlines.push(...response.headlines);
        }
      });
    } catch (error: any) {
      this.logger.error(`News.scrapeHeadlines() error: ${error.message}`);
      throw error;
    }
    return headlines;
  }

  async getHeadlines(): Promise<string[]> {
    const headlines: string[] = await this.scrapeHeadlines();
    const summary: string[] = await this.summarizeHeadlines(headlines);
    this.logger.verbose(`News.getHeadlines: %s`, JSON.stringify(summary, null, 2));
    return summary;
  }

}
