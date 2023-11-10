import OpenAI from 'openai';
import 'dotenv/config';
import { CNNScraper } from '../scrapers/news/index.js';
const { OPENAI_API_KEY, } = process.env;
async function summarizeHeadlines(headlines) {
    if (!OPENAI_API_KEY) {
        throw new Error('must specify OPENAI_API_KEY value in process.env');
    }
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
async function scrapeHeadlines() {
    const headlines = [];
    try {
        const cnnScraper = new CNNScraper();
        const cnnHeadlines = await cnnScraper.scrape();
        headlines.push(...cnnHeadlines);
    }
    catch (error) {
        console.error(`cnnScraper.scrape() failed: ${error.message}`);
        return [];
    }
    return headlines;
}
(async () => {
    const headlines = await scrapeHeadlines();
    const summary = await summarizeHeadlines(headlines);
    console.log(JSON.stringify(summary, null, 2));
})();
