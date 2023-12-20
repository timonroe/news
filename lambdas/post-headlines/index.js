import { Logger } from '@soralinks/logger';
import { S3Client, PutObjectCommand, } from "@aws-sdk/client-s3";
import { NewsScraperType, NewsScraperSource, } from '@soralinks/news-scrapers';
import { News } from '../../index.js';
const { NEWS_HEADLINES_DATA_S3_BUCKET, } = process.env;
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
async function putHeadlines(json) {
    const client = new S3Client({ region: "us-east-1" });
    const input = {
        Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
        Key: 'headlines-politics.json',
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
export const handler = async (event, context) => {
    const logger = new Logger({ logInfo: true, logError: true });
    logger.info('Starting: post-headlines Lambda');
    logger.verbose('event:', event);
    const ctx = JSON.parse(JSON.stringify(context)); // remove functions from the context
    logger.verbose('context:', ctx);
    const response = initResponse();
    try {
        const news = new News();
        const newsResponse = await news.getHeadlines({
            type: NewsScraperType.POLITICS,
            sources: [NewsScraperSource.AP, NewsScraperSource.CNN, NewsScraperSource.FOX, NewsScraperSource.WASH_EXAM],
            topHeadlines: {
                count: 20,
            },
        });
        logger.info(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
        await putHeadlines(newsResponse);
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
