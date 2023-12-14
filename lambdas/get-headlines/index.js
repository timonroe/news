import { Logger } from '@soralinks/logger';
import { NewsScraperType, NewsScraperSource, } from '@soralinks/news-scrapers';
import { News } from '../../index.js';
function initResponse() {
    return {
        isBase64Encoded: false,
        headers: {
            'content-type': 'application/json',
        },
        statusCode: 202,
        body: JSON.stringify({}),
    };
}
export const handler = async (event, context) => {
    const logger = new Logger({ logInfo: true, logError: true });
    logger.info('Starting: get-headlines Lambda');
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
        response.body = JSON.stringify(newsResponse);
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
