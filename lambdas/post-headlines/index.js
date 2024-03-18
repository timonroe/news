import { Logger } from '@soralinks/logger';
import { S3Client, GetObjectCommand, PutObjectCommand, } from "@aws-sdk/client-s3";
import { NewsScraperSource, } from '@soralinks/news-scrapers';
import OpenAI from "openai";
import { News, } from '../../index.js';
const { NEWS_HEADLINES_DATA_S3_BUCKET, NEWS_DEFAULT_NUM_TOP_HEADLINES, NEWS_DEFAULT_NUM_TOP_TOKENS, NEWS_SCRAPER_TYPE, NEWS_HEADLINES_FILENAME, NEWS_IGNORE_TOKENS_FILENAME, NEWS_MULTI_WORD_TOKENS_FILENAME, NEWS_SYNONYM_TOKENS_FILENAME, NEWS_OPENAI_API_KEY, NEWS_OPENAI_CORPORATION, NEWS_OPENAI_MODEL } = process.env;
function initResponse() {
    return {
        isBase64Encoded: false,
        headers: {
            'content-type': 'application/json',
        },
        statusCode: 200,
        body: JSON.stringify({}),
    };
}
// Send the headlines to the S3 bucket
async function postHeadlinesToS3(json) {
    const client = new S3Client({ region: 'us-east-1' });
    const input = {
        Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
        Key: NEWS_HEADLINES_FILENAME,
        Body: JSON.stringify(json),
    };
    const command = new PutObjectCommand(input);
    const response = await client.send(command);
    const statusCode = response.$metadata.httpStatusCode;
    if (statusCode !== 200) {
        throw new Error(`PutObjectCommand returned status code: ${statusCode}`);
    }
    return response;
}
// Update the multiWordTokens array with an array of names
function updateMultiWordTokens(multiWordTokens, synonymTokens, names) {
    if (!names || !names.length)
        return multiWordTokens;
    const updatedMultiWordTokens = [...multiWordTokens];
    for (let x = 0; x < names.length; x++) {
        const name = names[x];
        // If name is already in the multiWordTokens array
        if (multiWordTokens.find(token => token === name))
            continue;
        // If name is already in the synonymTokens array
        if (synonymTokens.find((synonymToken) => {
            const [key] = Object.keys(synonymToken);
            const values = synonymToken[key];
            if (values.find((token) => token === name))
                return true;
            return false;
        }))
            continue;
        updatedMultiWordTokens.push(name);
    }
    return updatedMultiWordTokens;
}
function generateOpenAIMessages(titles) {
    let content = `
    Extract the names of people mentioned in the sentences below. When doing so, please follow these rules closely: 
    - Include names that appear multiple times. 
    - If you encounter a name that specifies the first and last name, then encounter just the last name, include the last name as well. 
    - Remember, only include names of people. 
    - Return the results in an array named names within a JSON object. 
    Here are the list of sentences: `;
    titles.forEach(title => {
        content = content += `${title}.  `;
    });
    return [
        {
            role: 'user',
            content
        }
    ];
}
// Extract names of people from the titles
// Note: currently using AI for this
async function getNames(titles, logger) {
    const names = [];
    try {
        const messages = generateOpenAIMessages(titles);
        const openai = new OpenAI({
            apiKey: NEWS_OPENAI_API_KEY,
            organization: NEWS_OPENAI_CORPORATION,
        });
        const response = await openai.chat.completions.create({
            messages,
            // @ts-ignore
            model: NEWS_OPENAI_MODEL,
            temperature: 0.0, // get consistent results
        });
        const { choices } = response;
        if (!choices || !choices.length)
            throw new Error('choices field is undefined or an empty array');
        const [choice] = choices;
        const { message } = choice;
        if (!message)
            throw new Error('message field is undefined');
        let { content } = message;
        if (!content)
            throw new Error('content field is undefined');
        try {
            content = JSON.parse(content);
        }
        catch (error) {
            throw new Error('unable to JSON.parse content field');
        }
        // @ts-ignore
        const { names: allNames } = content;
        if (!allNames)
            throw new Error('names field is undefined');
        // Tokenize the names and remove duplicates
        // Only include full names, eg. "Tim Monroe" -vs- "Monroe"
        allNames.forEach((name) => {
            if (name.includes(' ') && !names.find((n) => n === name)) {
                // Convert the name to a token, removing commas, punctuation, etc.
                const tokenizedName = name.trim().replace(/’s|'s|[`'‘’:;",.?]/g, '');
                names.push(tokenizedName);
            }
        });
    }
    catch (error) {
        // Note: just logging the error and continuing as sometimes the OpenAI calls just fail
        logger.error(error.message);
    }
    return names;
}
// Get the tokens from the S3 bucket
async function getTokensFromS3(fileName) {
    if (!fileName)
        return {};
    const client = new S3Client({ region: 'us-east-1' });
    const input = {
        Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
        Key: fileName,
    };
    const command = new GetObjectCommand(input);
    const response = await client.send(command);
    const statusCode = response.$metadata.httpStatusCode;
    if (statusCode !== 200) {
        throw new Error(`GetObjectCommand returned status code: ${statusCode}`);
    }
    if (!response.Body) {
        throw new Error('GetObjectCommand response.Body is undefined');
    }
    const str = await response.Body.transformToString('utf-8');
    return JSON.parse(str);
}
async function getTokens() {
    return {
        ignoreTokens: (await getTokensFromS3(NEWS_IGNORE_TOKENS_FILENAME)).ignoreTokens,
        multiWordTokens: (await getTokensFromS3(NEWS_MULTI_WORD_TOKENS_FILENAME)).multiWordTokens,
        synonymTokens: (await getTokensFromS3(NEWS_SYNONYM_TOKENS_FILENAME)).synonymTokens,
    };
}
export const handler = async (event, context) => {
    const logger = new Logger({ logInfo: true, logError: true });
    logger.info('Starting: post-headlines Lambda');
    logger.verbose('event:', event);
    const ctx = JSON.parse(JSON.stringify(context)); // remove functions from the context
    logger.verbose('context:', ctx);
    const response = initResponse();
    try {
        // Get values from the environment variables
        // @ts-ignore
        const topHeadlinesCount = parseInt(NEWS_DEFAULT_NUM_TOP_HEADLINES, 10);
        logger.verbose(`topHeadlinesCount: ${topHeadlinesCount}`);
        // @ts-ignore
        const topTokensCount = parseInt(NEWS_DEFAULT_NUM_TOP_TOKENS, 10);
        logger.verbose(`topTokensCount: ${topTokensCount}`);
        // Get the tokens from S3
        const tokens = await getTokens();
        const { ignoreTokens, synonymTokens } = tokens;
        let { multiWordTokens } = tokens;
        logger.verbose(`ignoreTokens: ${JSON.stringify(ignoreTokens, null, 2)}`);
        logger.verbose(`multiWordTokens: ${JSON.stringify(multiWordTokens, null, 2)}`);
        logger.verbose(`synonymTokens: ${JSON.stringify(synonymTokens, null, 2)}`);
        // Get the headlines from the news sources
        const news = new News();
        const type = NEWS_SCRAPER_TYPE;
        const sources = [...Object.values(NewsScraperSource).map(source => source)];
        // @ts-ignore
        const scraperResponses = await news.scrapeHeadlines(type, sources);
        logger.verbose(`scraperResponses: ${JSON.stringify(scraperResponses, null, 2)}`);
        const titles = scraperResponses.map(scraperResponse => {
            return scraperResponse.headlines.map(headline => headline.title);
        }).flat();
        // Get the names from the titles, then add them to the multiWordTokens array
        const names = await getNames(titles, logger);
        multiWordTokens = updateMultiWordTokens(multiWordTokens, synonymTokens, names);
        // Tokenize the titles
        const tokenizedTitles = news.tokenizeTitles({
            scraperResponses,
            ignoreTokens,
            multiWordTokens,
            synonymTokens,
        });
        logger.verbose(`tokenizedTitles: ${JSON.stringify(tokenizedTitles, null, 2)}`);
        // Rank the tokens
        const rankedTokens = news.rankTokens(tokenizedTitles);
        logger.verbose(`rankedTokens: ${JSON.stringify(rankedTokens, null, 2)}`);
        // Get the top ranked tokens
        const topRankedTokens = [];
        for (let x = 0; x < topTokensCount && rankedTokens.length > x; x++) {
            topRankedTokens.push(rankedTokens[x]);
        }
        logger.verbose(`top${topTokensCount}Tokens: ${JSON.stringify(topRankedTokens, null, 2)}`);
        // Score the titles based on the ranked tokens
        const scoredTitles = news.scoreTitles(scraperResponses, rankedTokens);
        logger.verbose(`scoredTitles: ${JSON.stringify(scoredTitles, null, 2)}`);
        // Get the top ranked headlines
        const rankedHeadlines = scoredTitles.map(({ source, title, url }) => { return { source, title, url }; });
        const topRankedHeadlines = [];
        for (let x = 0; x < topHeadlinesCount && rankedHeadlines.length > x; x++) {
            topRankedHeadlines.push(rankedHeadlines[x]);
        }
        logger.verbose(`top${topHeadlinesCount}Headlines: ${JSON.stringify(topRankedHeadlines, null, 2)}`);
        // Post the headlines to S3
        const newsResponse = {
            scraperResponses: scraperResponses,
            topHeadlines: topRankedHeadlines.length ? topRankedHeadlines : undefined,
            topTokens: topRankedTokens.length ? topRankedTokens : undefined,
        };
        await postHeadlinesToS3(newsResponse);
        logger.info(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
        // Setup the response to be returned to the caller
        response.body = JSON.stringify(newsResponse);
    }
    catch (error) {
        response.statusCode = 400;
        response.body = JSON.stringify({ error: error.message });
        logger.error(error.message);
    }
    finally {
        logger.info('Finished: post-headlines Lambda');
    }
    return response;
};
