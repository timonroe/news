import { Logger } from '@soralinks/logger';
import {
  Handler as LambdaHandler,
  APIGatewayProxyEvent as LambdaEvent,
  Context as LambdaContext,
  APIGatewayProxyResult as LambdaResponse,
} from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  NewsScraperType,
  NewsScraperSource,
} from '@soralinks/news-scrapers';
import {
  DEFAULT_NUM_TOP_HEADLINES,
  DEFAULT_NUM_TOP_TOKENS,
  News,
  NewsResponse
} from '../../index.js';

const {
  NEWS_HEADLINES_DATA_S3_BUCKET,
  NEWS_DEFAULT_NUM_TOP_HEADLINES,
  NEWS_DEFAULT_NUM_TOP_TOKENS,
} = process.env;

function initResponse(): LambdaResponse {
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
async function postHeadlinesToS3(json: any) {
  const client = new S3Client({ region: 'us-east-1' });
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

// Get the ignoreTokens from the S3 bucket
async function getIgnoreTokensFromS3(): Promise<string[]> {
  const client = new S3Client({ region: 'us-east-1' });
  const input = {
    Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
    Key: 'ignore-tokens.json',
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
  const { ignoreTokens } = JSON.parse(str);
  return ignoreTokens;
}

export const handler: LambdaHandler = async (event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> => {
  const logger: Logger = new Logger({ logInfo: true, logError: true });
  logger.info('Starting: post-headlines Lambda');
  logger.verbose('event:', event);
  const ctx = JSON.parse(JSON.stringify(context)); // remove functions from the context
  logger.verbose('context:', ctx);
  const response = initResponse();
  try {
    let count;
    let topHeadlinesCount = DEFAULT_NUM_TOP_HEADLINES;
    if (NEWS_DEFAULT_NUM_TOP_HEADLINES) {
      count = parseInt(NEWS_DEFAULT_NUM_TOP_HEADLINES, 10);
      topHeadlinesCount = count >= 0 ? count : topHeadlinesCount;
    } 
    let topTokensCount = DEFAULT_NUM_TOP_TOKENS;
    if (NEWS_DEFAULT_NUM_TOP_TOKENS) {
      count = parseInt(NEWS_DEFAULT_NUM_TOP_TOKENS, 10);
      topTokensCount = count >= 0 ? count : topTokensCount;
    }
    const ignoreTokens = await getIgnoreTokensFromS3();
    const news: News = new News();
    const newsResponse: NewsResponse = await news.getHeadlines({
      type: NewsScraperType.POLITICS,
      sources: [...Object.values(NewsScraperSource).map(source => source)],
      ignoreTokens,
      options: {
        topHeadlinesCount,
        topTokensCount,
      },
    });
    logger.info(`newsResponse: ${JSON.stringify(newsResponse, null, 2)}`);
    await postHeadlinesToS3(newsResponse);
    response.body = JSON.stringify(newsResponse);
  } catch (error: any) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: error.message });
    logger.error(error.message);
  } finally {
    logger.info('Finished: post-headlines Lambda');
  }
  return response;
}
