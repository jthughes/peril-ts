import { writeLog } from "../internal/gamelogic/logs.js";
import { AckType } from "../internal/pubsub/subscribe.js";

export async function handlerLogs(log: GameLog) {
  try {
    await writeLog(log);
  } catch (err) {
    return AckType.NackDiscard;
  }
  return AckType.Ack;
}
