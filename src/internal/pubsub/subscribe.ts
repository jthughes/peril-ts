import { decode } from "@msgpack/msgpack";
import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "./publish.js";

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    simpleQueueType,
  );

  await ch.prefetch(10);

  ch.consume(queue.queue, async (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;

    let msgData: T;
    try {
      msgData = unmarshaller(msg.content);
    } catch (err) {
      console.error("Could not unmarshal meesage:", err);
      return;
    }

    try {
      const resp = await handler(msgData);
      switch (resp) {
        case AckType.Ack: {
          ch.ack(msg);
          console.log(`ACK: ${msg}`);
          break;
        }
        case AckType.NackRequeue: {
          ch.nack(msg, false, true);
          console.log(`NACK: (Retry) ${msg}`);
          break;
        }
        case AckType.NackDiscard: {
          ch.nack(msg, false, false);
          console.log(`NACK: (Discard) ${msg}`);
          break;
        }
        default: {
          const unreachable: never = resp;
          console.error("Error handling message:", unreachable);
          return;
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
      ch.nack(msg, false, false);
      return;
    }
  });
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  subscribe(conn, exchange, queueName, key, queueType, handler, (msg) => {
    return JSON.parse(msg.toString());
  });
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(conn, exchange, queueName, key, queueType, handler, decode);
}
