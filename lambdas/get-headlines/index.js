import { Logger } from '@soralinks/logger';
import { S3Client, GetObjectCommand, } from "@aws-sdk/client-s3";
const { NEWS_HEADLINES_DATA_S3_BUCKET, NEWS_HEADLINES_FILENAME, } = process.env;
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
// Get the headlines from the S3 bucket
async function getHeadlinesFromS3() {
    const client = new S3Client({ region: 'us-east-1' });
    const input = {
        Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
        Key: NEWS_HEADLINES_FILENAME,
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
export const handler = async (event, context) => {
    const logger = new Logger({ logInfo: true, logError: true });
    logger.info('Starting: get-headlines Lambda');
    logger.verbose('event:', event);
    const ctx = JSON.parse(JSON.stringify(context)); // remove functions from the context
    logger.verbose('context:', ctx);
    const response = initResponse();
    try {
        const newsResponse = await getHeadlinesFromS3();
        logger.info(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
        // Only send back what's being used on the client
        const { scraperResponses } = newsResponse;
        newsResponse.scraperResponses = scraperResponses.map(scraperResponse => {
            const { headlines } = scraperResponse;
            return {
                ...scraperResponse,
                headlines: headlines.map(headline => {
                    return {
                        title: headline.title,
                        url: headline.url,
                    };
                }),
            };
        });
        response.body = JSON.stringify(newsResponse, null, 2);
    }
    catch (error) {
        response.statusCode = 400;
        response.body = JSON.stringify({ error: error.message });
        logger.error(error.message);
    }
    finally {
        logger.info('Finished: get-headlines Lambda');
    }
    return response;
};
