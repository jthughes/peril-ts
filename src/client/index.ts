import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  console.log("Starting Peril client...");

  const connectionString = `amqp://guest:guest@localhost:5672/`;
  const connection = await amqp.connect(connectionString);

  const input = await clientWelcome();

  const a = await declareAndBind(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${input}`,
    PauseKey,
    SimpleQueueType.Transient,
  );
  // const chConfirm = await connection.createConfirmChannel();

  // const data = JSON.stringify({ isPaused: true });

  // publishJSON(chConfirm, "peril_direct", "pause", data);

  console.log("Connection successful!");
  process.on("SIGINT", async () => {
    console.log("Closing connection and shutting down...");
    await connection.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
