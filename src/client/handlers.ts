// import { ConfirmChannel } from "amqplib";
// import { RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
// import { ConfirmChannel } from "amqplib";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import { AckType } from "../internal/pubsub/subscribe.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { publishGameLog } from "./publish.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return AckType.Ack;
  };
}

export function handlerMove(gs: GameState, ch: ConfirmChannel) {
  return async (move: ArmyMove) => {
    try {
      const outcome = handleMove(gs, move);
      switch (outcome) {
        case MoveOutcome.Safe:
          return AckType.Ack;
        case MoveOutcome.MakeWar:
          const recognition: RecognitionOfWar = {
            attacker: move.player,
            defender: gs.getPlayerSnap(),
          };
          try {
            await publishJSON(
              ch,
              ExchangePerilTopic,
              `${WarRecognitionsPrefix}.${gs.getUsername()}`,
              recognition,
            );
            return AckType.Ack;
          } catch (err) {
            console.error("Error publishing war recognition:", err);
            return AckType.NackRequeue;
          }
        default:
          return AckType.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

export function handlerWar(
  gs: GameState,
  ch: ConfirmChannel,
): (war: RecognitionOfWar) => Promise<AckType> {
  return async (war: RecognitionOfWar): Promise<AckType> => {
    try {
      const resolution = handleWar(gs, war);
      let msg = "";
      switch (resolution.result) {
        case WarOutcome.NotInvolved:
          return AckType.NackRequeue;
        case WarOutcome.NoUnits:
          return AckType.NackDiscard;
        case WarOutcome.OpponentWon:
          msg = `${resolution.winner} won a war againt ${resolution.loser}`;
          try {
            publishGameLog(ch, gs.getUsername(), msg);
          } catch (err) {
            console.log("Error publishing log:", err);
            return AckType.NackRequeue;
          }
          return AckType.Ack;
        case WarOutcome.YouWon:
          msg = `${resolution.winner} won a war againt ${resolution.loser}`;
          try {
            publishGameLog(ch, gs.getUsername(), msg);
          } catch (err) {
            console.log("Error publishing log:", err);
            return AckType.NackRequeue;
          }
          return AckType.Ack;
        case WarOutcome.Draw:
          msg = `A war between ${resolution.attacker} and ${resolution.defender} resulted in a draw`;
          try {
            publishGameLog(ch, gs.getUsername(), msg);
          } catch (err) {
            console.log("Error publishing log:", err);
            return AckType.NackRequeue;
          }
          return AckType.Ack;
        default:
          const unreachable: never = resolution;
          console.log(`Error: ${unreachable} not recognised as WarOutcome`);
          return AckType.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}
