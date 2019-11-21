import { APIGatewayEvent } from "aws-lambda";

export default async (event: APIGatewayEvent): Promise<object> => {
  console.log(event);

  return {
    statusCode: 200,
    body: "",
  };
};
