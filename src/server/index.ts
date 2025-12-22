import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

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

  try {
    await publishJSON(chConfirm, ExchangePerilDirect, PauseKey, {
      isPaused: true,
    });
  } catch (err) {
    console.error("Error publishing message:", err);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
