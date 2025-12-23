import amqp from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
} from "../internal/gamelogic/gamelogic.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { publishJSON, SimpleQueueType } from "../internal/pubsub/publish.js";
import { subscribeJSON } from "../internal/pubsub/subscribe.js";
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  PauseKey,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";

async function main() {
  console.log("Starting Peril client...");

  const connectionString = `amqp://guest:guest@localhost:5672/`;
  const connection = await amqp.connect(connectionString);

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
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

  const username = await clientWelcome();

  const state = new GameState(username);
  const confCh = await connection.createConfirmChannel();

  await subscribeJSON(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(state),
  );

  await subscribeJSON(
    connection,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(state, confCh),
  );

  await subscribeJSON(
    connection,
    ExchangePerilTopic,
    WarRecognitionsPrefix,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(state),
  );

  while (true) {
    const userInput = await getInput("> ");
    if (userInput.length == 0) {
      continue;
    }
    const command = userInput[0];
    const words = userInput;

    if (command == "spawn") {
      try {
        commandSpawn(state, words);
      } catch (err) {
        if (err instanceof Error) {
          console.error("Error:", err.message);
        } else {
          console.error("Error:", err);
        }
      }
      continue;
    }

    if (command == "move") {
      try {
        const move = commandMove(state, words);
        publishJSON(
          confCh,
          ExchangePerilTopic,
          `${ArmyMovesPrefix}.${username}`,
          move,
        );
      } catch (err) {
        if (err instanceof Error) {
          console.error("Error:", err.message);
        } else {
          console.error("Error:", err);
        }
      }
      continue;
    }

    if (command == "status") {
      await commandStatus(state);
      continue;
    }

    if (command == "help") {
      printClientHelp();
      continue;
    }

    if (command == "spam") {
      console.log("Spamming not allowed yet!");
      continue;
    }

    if (command == "quit") {
      console.log("Exiting...");
      process.exit(0);
    }
    console.log(`Command ${command} not recognised`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
