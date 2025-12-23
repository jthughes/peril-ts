import amqp from "amqplib";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { writeLog } from "../internal/gamelogic/logs.js";
import {
  declareAndBind,
  publishJSON,
  SimpleQueueType,
} from "../internal/pubsub/publish.js";
import { subscribeMsgPack } from "../internal/pubsub/subscribe.js";
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
} from "../internal/routing/routing.js";
import { handlerLogs } from "./handlers.js";

async function main() {
  console.log("Starting Peril server...");

  const connectionString = `amqp://guest:guest@localhost:5672/`;
  const connection = await amqp.connect(connectionString);

  console.log("Connection successful!");

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on("SIGINT", async () => {
      console.log("Closing connection and shutting down...");
      try {
        await connection.close();
        console.log("Connection closed");
      } catch (err) {
        console.log("Error closing connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const chConfirm = await connection.createConfirmChannel();

  // const gameLog = await declareAndBind(
  //   connection,
  //   ExchangePerilTopic,
  //   GameLogSlug,
  //   `${GameLogSlug}.*`,
  //   SimpleQueueType.Durable,
  // );

  subscribeMsgPack(
    connection,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
    handlerLogs,
  );
  if (!process.stdin.isTTY) {
    console.log("Non-interactive mode: skipping command input.");
    return;
  }
  printServerHelp();
  while (true) {
    const userInput = await getInput();
    if (userInput.length == 0) {
      continue;
    }

    if (userInput[0] == "pause") {
      console.log("Sending pause message");
      try {
        await publishJSON(chConfirm, ExchangePerilDirect, PauseKey, {
          isPaused: true,
        });
      } catch (err) {
        console.error("Error publishing message:", err);
      }
      continue;
    }

    if (userInput[0] == "resume") {
      console.log("Sending resume message");
      try {
        await publishJSON(chConfirm, ExchangePerilDirect, PauseKey, {
          isPaused: false,
        });
      } catch (err) {
        console.error("Error publishing message:", err);
      }
      continue;
    }
    if (userInput[0] == "quit") {
      console.log("Exiting...");
      process.exit(0);
    }
    console.log(`Command ${userInput[0]} not recognised`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
