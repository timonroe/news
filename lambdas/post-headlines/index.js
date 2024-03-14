import { Logger } from '@soralinks/logger';
import { S3Client, GetObjectCommand, PutObjectCommand, } from "@aws-sdk/client-s3";
import { NewsScraperSource, } from '@soralinks/news-scrapers';
import { News, } from '../../index.js';
const { NEWS_HEADLINES_DATA_S3_BUCKET, NEWS_DEFAULT_NUM_TOP_HEADLINES, NEWS_DEFAULT_NUM_TOP_TOKENS, NEWS_SCRAPER_TYPE, NEWS_HEADLINES_FILENAME, NEWS_IGNORE_TOKENS_FILENAME, NEWS_MULTI_WORD_TOKENS_FILENAME, NEWS_SYNONYM_TOKENS_FILENAME } = process.env;
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
        const { ignoreTokens, multiWordTokens, synonymTokens } = await getTokens();
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
