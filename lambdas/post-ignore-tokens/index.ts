import { Logger } from '@soralinks/logger';
import {
  Handler as LambdaHandler,
  APIGatewayProxyEvent as LambdaEvent,
  Context as LambdaContext,
  APIGatewayProxyResult as LambdaResponse,
} from 'aws-lambda';
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const {
  NEWS_HEADLINES_DATA_S3_BUCKET,
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

// Send the ignore tokens to the S3 bucket
async function postIgnoreTokensToS3(json: any) {
  const client = new S3Client({ region: "us-east-1" });
  const input = {
    Bucket: NEWS_HEADLINES_DATA_S3_BUCKET,
    Key: 'ignore-tokens.json',
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

export const handler: LambdaHandler = async (event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> => {
  const logger: Logger = new Logger({ logInfo: true, logError: true });
  logger.info('Starting: post-ignore-tokens Lambda');
  logger.verbose('event:', event);
  const ctx = JSON.parse(JSON.stringify(context)); // remove functions from the context
  logger.verbose('context:', ctx);
  const response = initResponse();
  try {
    // @ts-ignore
    const { ignoreTokens } = event;
    if (ignoreTokens && Array.isArray(ignoreTokens) && ignoreTokens.length) {
      await postIgnoreTokensToS3(ignoreTokens);
      logger.info(`ignoreTokens: ${JSON.stringify(ignoreTokens, null, 2)}`);
      response.body = JSON.stringify(ignoreTokens);
    } else {
      const msg = 'ignoreTokens were not passed in to the lambda function';
      logger.info(msg);
      response.body = JSON.stringify(msg);
    }
  } catch (error: any) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: error.message });
    logger.error(error.message);
  } finally {
    logger.info('Finished: post-ignore-tokens Lambda');
  }
  return response;
}
