import OpenAI from 'openai';
import 'dotenv/config';
import { CNNScraper } from '../scrapers/news/index.js';

const {
  OPENAI_API_KEY,
} = process.env;

async function summarizeHeadlines(headlines: string[]): Promise<string[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('must specify OPENAI_API_KEY value in process.env');
  }
  let prompt = 'Given the following news headlines:\n\n';
  prompt += headlines.join('\n');
  prompt += `\n\nProduce a summarized list of headlines, no more than 5, that best represents all of the headlines.\n\n`;
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
  } catch (error) {
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

async function scrapeHeadlines(): Promise<string[]> {
  const headlines: string[] = [];
  try {
    const cnnScraper: CNNScraper = new CNNScraper();
    const cnnHeadlines: string[] = await cnnScraper.scrape();
    headlines.push(...cnnHeadlines);
  } catch (error: any) {
    console.error(`CNNScraper.scrape() failed: ${error.message}`);
    throw error;
  }
  return headlines;
}

(async () => {
  const headlines: string[] = await scrapeHeadlines();
  const summary: string[] = await summarizeHeadlines(headlines);
  console.log(JSON.stringify(summary, null, 2));

})();
