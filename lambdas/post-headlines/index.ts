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
  NewsScraperSource,
  NewsScraperResponse,
} from '@soralinks/news-scrapers';
import {
  NewsHeadline,
  RankedToken,
  NewsResponse,
  News,
} from '../../index.js';

const {
  NEWS_HEADLINES_DATA_S3_BUCKET,
  NEWS_DEFAULT_NUM_TOP_HEADLINES,
  NEWS_DEFAULT_NUM_TOP_TOKENS,
  NEWS_SCRAPER_TYPE,
  NEWS_HEADLINES_FILENAME,
  NEWS_IGNORE_TOKENS_FILENAME,
  NEWS_MULTI_WORD_TOKENS_FILENAME,
  NEWS_SYNONYM_TOKENS_FILENAME
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
async function getTokensFromS3(fileName: string | undefined): Promise<any> {
  if (!fileName) return {};
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

async function getTokens(): Promise<any> {
  return {
    ignoreTokens: (await getTokensFromS3(NEWS_IGNORE_TOKENS_FILENAME)).ignoreTokens,
    multiWordTokens: (await getTokensFromS3(NEWS_MULTI_WORD_TOKENS_FILENAME)).multiWordTokens,
    synonymTokens: (await getTokensFromS3(NEWS_SYNONYM_TOKENS_FILENAME)).synonymTokens,
  };
}

export const handler: LambdaHandler = async (event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> => {
  const logger: Logger = new Logger({ logInfo: true, logError: true });
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
    const {
      ignoreTokens,
      multiWordTokens,
      synonymTokens
    } = await getTokens();
    logger.verbose(`ignoreTokens: ${JSON.stringify(ignoreTokens, null, 2)}`);
    logger.verbose(`multiWordTokens: ${JSON.stringify(multiWordTokens, null, 2)}`);
    logger.verbose(`synonymTokens: ${JSON.stringify(synonymTokens, null, 2)}`);

    // Get the headlines from the news sources
    const news: News = new News();
    const type = NEWS_SCRAPER_TYPE;
    const sources = [...Object.values(NewsScraperSource).map(source => source)];
    // @ts-ignore
    const scraperResponses: NewsScraperResponse[] = await news.scrapeHeadlines(type, sources);
    logger.verbose(`scraperResponses: ${JSON.stringify(scraperResponses, null, 2)}`);
   
    // Tokenize the titles
    const tokenizedTitles: string[][][] = news.tokenizeTitles({
      scraperResponses,
      ignoreTokens,
      multiWordTokens,
      synonymTokens,
    });
    logger.verbose(`tokenizedTitles: ${JSON.stringify(tokenizedTitles, null, 2)}`);

    // Rank the tokens
    const rankedTokens: RankedToken[] = news.rankTokens(tokenizedTitles);
    logger.verbose(`rankedTokens: ${JSON.stringify(rankedTokens, null, 2)}`);

    // Get the top ranked tokens
    const topRankedTokens: RankedToken[] = []
    for(let x = 0; x < topTokensCount && rankedTokens.length > x; x++) {
      topRankedTokens.push(rankedTokens[x]);
    }
    logger.verbose(`top${topTokensCount}Tokens: ${JSON.stringify(topRankedTokens, null, 2)}`);

    // Score the titles based on the ranked tokens
    const scoredTitles: any[] = news.scoreTitles(scraperResponses, rankedTokens);
    logger.verbose(`scoredTitles: ${JSON.stringify(scoredTitles, null, 2)}`);

    // Get the top ranked headlines
    const rankedHeadlines: NewsHeadline[] = scoredTitles.map(({ source, title, url }) => { return { source, title, url } });
    const topRankedHeadlines: NewsHeadline[] = []
    for(let x = 0; x < topHeadlinesCount && rankedHeadlines.length > x; x++) {
      topRankedHeadlines.push(rankedHeadlines[x]);
    }
    logger.verbose(`top${topHeadlinesCount}Headlines: ${JSON.stringify(topRankedHeadlines, null, 2)}`);

    // Post the headlines to S3
    const newsResponse: NewsResponse = {
      scraperResponses: scraperResponses,
      topHeadlines: topRankedHeadlines.length ? topRankedHeadlines : undefined,
      topTokens: topRankedTokens.length ? topRankedTokens : undefined,
    };
    await postHeadlinesToS3(newsResponse);

    // Setup the response to be returned to the caller
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
