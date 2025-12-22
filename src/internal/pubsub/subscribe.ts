import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "./publish.js";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => void,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );

  ch.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
    if (msg != null) {
      const msgData = JSON.parse(msg.content.toString());
      handler(msgData);
      ch.ack(msg);
    }
  });
}
