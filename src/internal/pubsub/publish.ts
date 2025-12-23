import { encode } from "@msgpack/msgpack";
import amqp, { type Channel } from "amqplib";
import { rejects } from "assert";

export async function publishJSON<T>(
  ch: amqp.ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const content = Buffer.from(JSON.stringify(value));
  ch.publish(exchange, routingKey, content, {
    contentType: "application/json",
  });
  return;
}

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();
  const queue = await ch.assertQueue(queueName, {
    durable: queueType == SimpleQueueType.Durable,
    autoDelete: queueType == SimpleQueueType.Transient,
    exclusive: queueType == SimpleQueueType.Transient,
    arguments: { "x-dead-letter-exchange": "peril_dlx" },
  });

  ch.bindQueue(queueName, exchange, key);

  return [ch, queue];
}

export async function publishMsgPack<T>(
  ch: amqp.ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const content = encode(value);
  return new Promise((resolve, reject) => {
    ch.publish(
      exchange,
      routingKey,
      Buffer.from(content),
      {
        contentType: "application/x-msgpack",
      },
      (err) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        } else {
          resolve();
        }
      },
    );
  });
}
