import { BreathPacerInstruction } from "./BreathPacer";

export function parseInstructionsCSV(text: string): BreathPacerInstruction[] {
    return text.trim().split("\n").map((line: string): BreathPacerInstruction => {
        if ((line.match(/,/g) ?? []).length != 1) {
            throw new Error(`line "${line}" does not contain exactly one comma`);
        }
        const [dstring, breathe] = line.split(",");
        const duration = parseInt(dstring, 10);
        if (Number.isNaN(duration) || duration < 0) {
            throw new Error(`failed to parse nonnegative numeric duration from "${dstring}"`);
        }
        if (breathe !== "in" && breathe !== "out" && breathe !== "hold") {
            throw new Error(`breathe instruction "${breathe}" must be "in", "out", or "hold"`);
        }
        return {duration, breathe};
    });
}
