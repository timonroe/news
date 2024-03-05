import { Logger } from '@soralinks/logger';
import { S3Client, GetObjectCommand, PutObjectCommand, } from "@aws-sdk/client-s3";
import { NewsScraperSource, } from '@soralinks/news-scrapers';
import { DEFAULT_NUM_TOP_HEADLINES, DEFAULT_NUM_TOP_TOKENS, News } from '../../index.js';
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
        let count;
        let topHeadlinesCount = DEFAULT_NUM_TOP_HEADLINES;
        if (NEWS_DEFAULT_NUM_TOP_HEADLINES) {
            count = parseInt(NEWS_DEFAULT_NUM_TOP_HEADLINES, 10);
            topHeadlinesCount = count >= 0 ? count : topHeadlinesCount;
        }
        logger.verbose(`topHeadlinesCount: ${topHeadlinesCount}`);
        let topTokensCount = DEFAULT_NUM_TOP_TOKENS;
        if (NEWS_DEFAULT_NUM_TOP_TOKENS) {
            count = parseInt(NEWS_DEFAULT_NUM_TOP_TOKENS, 10);
            topTokensCount = count >= 0 ? count : topTokensCount;
        }
        logger.verbose(`topTokensCount: ${topTokensCount}`);
        // Get the tokens from S3
        const { ignoreTokens, multiWordTokens, synonymTokens } = await getTokens();
        logger.verbose(`ignoreTokens: ${JSON.stringify(ignoreTokens, null, 2)}`);
        logger.verbose(`multiWordTokens: ${JSON.stringify(multiWordTokens, null, 2)}`);
        logger.verbose(`synonymTokens: ${JSON.stringify(synonymTokens, null, 2)}`);
        // Get the headlines from the news sources
        const news = new News();
        const newsResponse = await news.getHeadlines({
            // @ts-ignore
            type: NEWS_SCRAPER_TYPE,
            sources: [...Object.values(NewsScraperSource).map(source => source)],
            ignoreTokens,
            multiWordTokens,
            synonymTokens,
            options: {
                topHeadlinesCount,
                topTokensCount,
            },
        });
        logger.info(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
        // Post the headlines data to S3
        await postHeadlinesToS3(newsResponse);
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
