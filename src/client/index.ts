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
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");

  const connectionString = `amqp://guest:guest@localhost:5672/`;
  const connection = await amqp.connect(connectionString);

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

  const username = await clientWelcome();

  const pauseQueue = await declareAndBind(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );

  const state = new GameState(username);

  while (true) {
    const userInput = await getInput();
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
