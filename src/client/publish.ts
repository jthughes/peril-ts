// import { ConfirmChannel } from "amqplib";
// import { GameLog } from "../internal/gamelogic/logs.js";
import { publishMsgPack } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  GameLogSlug,
} from "../internal/routing/routing.js";

export async function publishGameLog(
  ch: ConfirmChannel,
  username: string,
  message: string,
) {
  const log: GameLog = {
    username: username,
    message: message,
    currentTime: new Date(Date.now()),
  };
  try {
    await publishMsgPack(
      ch,
      ExchangePerilTopic,
      `${GameLogSlug}.${username}`,
      log,
    );
  } catch (err) {
    console.log(`Error: Unable to publish message: ${err}`);
  }
}
