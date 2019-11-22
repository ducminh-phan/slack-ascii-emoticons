import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "querystring";
import { createHmac } from "crypto";
import axios, { AxiosResponse } from "axios";

import emoMapping from "./emoMapping";

interface SlackRequestBody {
  text: string;
  user_id: string;
  response_url: string;
}

const isValidSlackRequest = (
  headers: APIGatewayEvent["headers"],
  body: APIGatewayEvent["body"],
): boolean => {
  const signature: string = headers["X-Slack-Signature"];
  const timestamp: string = headers["X-Slack-Request-Timestamp"];
  const signaturePlaintext = `v0:${timestamp}:${body}`;

  const hmac = createHmac("sha256", process.env.SLACK_SIGNING_SECRET);

  hmac.update(signaturePlaintext);

  return `v0=${hmac.digest("hex")}` === signature;
};

const getHelpMessage = (): string => {
  return Object.keys(emoMapping)
    .map(name => `\`${name}\`: ${emoMapping[name]}`)
    .join("\n");
};

const isHelpRequested = (requestText: string): boolean => {
  return requestText === "help";
};

const emoNotFound = (requestText: string): boolean => {
  return !(requestText in emoMapping);
};

const getResponseText = (requestText: string, user_id: string): string => {
  if (isHelpRequested(requestText)) {
    return getHelpMessage();
  } else if (emoNotFound(requestText)) {
    return "No such emo!";
  } else {
    return `<@${user_id}>: ${emoMapping[requestText]}`;
  }
};

const getResponseType = (requestText: string): string => {
  return requestText in emoMapping ? "in_channel" : "ephemeral";
};

const respond = async (
  response_url: string,
  data: object,
): Promise<AxiosResponse> => {
  return axios.post(response_url, data, {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_OAUTH_ACCESS_TOKEN}`,
    },
  });
};

export default async (
  event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
  console.log(JSON.stringify(event));

  if (!isValidSlackRequest(event.headers, event.body)) {
    return {
      statusCode: 400,
      body: null,
    };
  }

  const { text, user_id, response_url } = (parse(
    event.body,
  ) as unknown) as SlackRequestBody;

  await respond(response_url, {
    text: getResponseText(text, user_id),
    response_type: getResponseType(text),
  });

  return {
    statusCode: 200,
    body: null,
  };
};
