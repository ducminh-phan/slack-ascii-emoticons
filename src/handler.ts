import { APIGatewayEvent } from "aws-lambda";
import { parse } from "querystring";
import { createHmac } from "crypto";
import * as slack from "slack";

import emoMapping from "./emoMapping";

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
  let helpMessage = "";
  for (const emo in emoMapping) {
    helpMessage += "*" + emo + "*: " + emoMapping[emo] + "\n";
  }

  return helpMessage;
};

const getResponseMessage = (text: string): string => {
  if (text === "help") {
    return getHelpMessage();
  }

  return emoMapping[text] ?? "";
};

export default async (event: APIGatewayEvent): Promise<object> => {
  console.log(JSON.stringify(event));

  const { text, channel_id } = parse(event.body);

  if (!isValidSlackRequest(event.headers, event.body)) {
    return {
      statusCode: 400,
    };
  }

  const message = getResponseMessage(text as string);

  try {
    await slack.chat.postMessage({
      token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
      channel: channel_id,
      text: message,
      as_user: text !== "help",
    });
  } catch (e) {
    console.log(e);

    return {
      statusCode: 500,
    };
  }

  return {
    statusCode: 200,
  };
};
