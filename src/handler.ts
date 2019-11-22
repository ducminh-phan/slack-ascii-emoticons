import { APIGatewayEvent } from "aws-lambda";
import { parse } from "querystring";
import { createHmac } from "crypto";
import * as slack from "slack";

import emoMapping from "./emoMapping";

interface SlackRequestBody {
  token: string;
  team_id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  text: string;
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
  let helpMessage = "";
  for (const emo in emoMapping) {
    helpMessage += "*" + emo + "*: " + emoMapping[emo] + "\n";
  }

  return helpMessage;
};

const handleHelp = async ({ channel_id, user_id }): Promise<void> => {
  await slack.chat.postEphemeral({
    token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
    channel: channel_id,
    user: user_id,
    text: getHelpMessage(),
  });
};

const handleEmo = async ({ channel_id, text, user_name }): Promise<void> => {
  await slack.chat.postMessage({
    token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
    channel: channel_id,
    text: emoMapping[text],
    username: user_name,
  });
};

const handleNoEmo = async ({ channel_id, user_id }): Promise<void> => {
  await slack.chat.postEphemeral({
    token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
    channel: channel_id,
    user: user_id,
    text: "No such emo (yet)!",
  });
};

const handleError = async ({ channel_id, user_id }): Promise<void> => {
  await slack.chat.postEphemeral({
    token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
    channel: channel_id,
    user: user_id,
    text: "Something went wrong!",
  });
};

export default async (event: APIGatewayEvent): Promise<object> => {
  console.log(JSON.stringify(event));

  const parsedBody = (parse(event.body) as unknown) as SlackRequestBody;

  if (!isValidSlackRequest(event.headers, event.body)) {
    return {
      statusCode: 400,
    };
  }

  try {
    if (parsedBody.text === "help") {
      await handleHelp(parsedBody);
    } else if (!(parsedBody.text in emoMapping)) {
      await handleNoEmo(parsedBody);
    } else {
      await handleEmo(parsedBody);
    }
  } catch (e) {
    console.log(e);
    await handleError(parsedBody);
  }

  return {
    statusCode: 200,
  };
};
